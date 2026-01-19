from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time
import sys
import os
import networkx as nx
import osmnx as ox

# Add backend to path to import existing modules
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.dirname(current_dir)
project_root = os.path.dirname(backend_root)
sys.path.append(backend_root)

from data_loader import DataLoader
from algorithms import PathFinder
from api.supabase_client import get_supabase

app = FastAPI(title="TuDistri API", description="API for Portoviejo Route Optimization", version="1.0.0")

supabase = get_supabase()

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from simulation_engine import MarkovChain, FactorSimulator, KPICalculator, AdminKPICalculator
from validation.validator_service import ValidatorService

# Global variables
graph = None
path_finder = None
markov_chain = MarkovChain() # Estado global del sistema
validator_service = None

@app.on_event("startup")
async def startup_event():
    global graph, path_finder, validator_service
    print("Loading graph...")
    # Initialize DataLoader with absolute path to data directory
    data_dir = os.path.join(project_root, 'data')
    loader = DataLoader(data_dir=data_dir)
    try:
        graph = loader.load_graph()
        if graph is None:
            raise ValueError("Graph loader returned None")
        path_finder = PathFinder(graph)
        validator_service = ValidatorService(graph, path_finder)
        print(f"Graph loaded successfully with {len(graph.nodes)} nodes!")
    except Exception as e:
        print(f"CRITICAL ERROR loading graph: {e}")
        # In a real production app, we might want to prevent startup if graph is required
        # For now, we allow it but endpoints will fail gracefully
        graph = None
        path_finder = None

@app.get("/health")
async def health_check():
    return {
        "status": "ok" if graph is not None else "degraded",
        "graph_loaded": graph is not None,
        "supabase_connected": supabase is not None
    }

class RouteRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    mode: str = "driving"

class SimulationRequest(BaseModel):
    user_lat: float
    user_lng: float
    product_id: str
    weight: float = 1.0

class RecalculateRequest(BaseModel):
    current_lat: float
    current_lng: float
    dest_lat: float
    dest_lng: float
    event_type: str
    simulation_id: Optional[str] = None
    progress: Optional[float] = 0.0

@app.post("/api/routes/recalculate")
async def recalculate_route(request: RecalculateRequest):
    if graph is None:
        raise HTTPException(status_code=503, detail="Graph service not available")

    # Find nodes
    try:
        start_node = ox.distance.nearest_nodes(graph, request.current_lng, request.current_lat)
        end_node = ox.distance.nearest_nodes(graph, request.dest_lng, request.dest_lat)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error finding nodes: {e}")

    # Calculate new route with event penalty
    result = path_finder.run_dijkstra(start_node, end_node, weight='weight', event_type=request.event_type)

    if not result["path"]:
        raise HTTPException(status_code=404, detail="No route found")

    # Decode path
    path_coords = []
    path_nodes = result["path"]
    
    total_distance_m = 0
    
    for i in range(len(path_nodes) - 1):
        u, v = path_nodes[i], path_nodes[i+1]
        edge_data = graph.get_edge_data(u, v)[0]
        
        # Calculate distance
        total_distance_m += float(edge_data.get('length', 0))
        
        if 'geometry' in edge_data:
            for x, y in list(edge_data['geometry'].coords):
                if not path_coords or path_coords[-1] != [y, x]:
                    path_coords.append([y, x])
        else:
            node_u = graph.nodes[u]
            node_v = graph.nodes[v]
            if not path_coords or path_coords[-1] != [node_u['y'], node_u['x']]:
                path_coords.append([node_u['y'], node_u['x']])
            path_coords.append([node_v['y'], node_v['x']])

    # Persist event if simulation_id provided
    if request.simulation_id:
        try:
            supabase.table("simulation_events").insert({
                "simulation_id": request.simulation_id,
                "event_type": request.event_type,
                "trigger_location": {"lat": request.current_lat, "lng": request.current_lng},
                "trigger_progress": request.progress,
                "impact_metrics": {
                    "distance_added": total_distance_m, # This is total remaining, diff calc would be better but this is fine
                    "new_duration": round(result["cost"] / 60, 2)
                }
            }).execute()
        except Exception as e:
            print(f"Failed to log event: {e}")

    return {
        "route_geometry": path_coords,
        "distance_km": total_distance_m / 1000,
        "duration_min": round(result["cost"] / 60, 2),
        "event_applied": request.event_type
    }

@app.get("/")
async def root():
    return {"message": "Welcome to TuDistri API"}

@app.get("/api/products")
async def get_products():
    response = supabase.table("products").select("*").execute()
    return {"products": response.data}

@app.get("/api/sellers")
async def get_sellers(product_id: Optional[str] = None):
    if product_id:
        # Use Postgres array contains operator @>
        response = supabase.table("sellers").select("*").filter("products", "cs", f"{{{product_id}}}").execute()
        return {"sellers": response.data}
    response = supabase.table("sellers").select("*").execute()
    return {"sellers": response.data}

@app.get("/api/pois")
async def get_pois(category: Optional[str] = None):
    query = supabase.table("pois").select("*")
    if category:
        query = query.eq("category", category)
    response = query.execute()
    return {"pois": response.data}

@app.post("/api/routes/simulate")
async def simulate_routes(request: SimulationRequest):
    if graph is None:
        raise HTTPException(status_code=503, detail="Graph service not available")

    # Get product details from Supabase first
    try:
        product_response = supabase.table("products").select("*").eq("id", request.product_id).single().execute()
        product = product_response.data
    except Exception:
        raise HTTPException(status_code=404, detail=f"Product {request.product_id} not found")

    # Get sellers that offer the product from Supabase
    sellers_response = supabase.table("sellers").select("*").filter("products", "cs", f"{{{request.product_id}}}").execute()
    sellers = sellers_response.data
    
    if not sellers:
        return {"routes": []}

    routes_result = []
    
    # Find nearest node to user
    try:
        user_node = ox.distance.nearest_nodes(graph, request.user_lng, request.user_lat)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error finding user location on map: {e}")

    for seller in sellers:
        seller_coords = seller["coordinates"]
        try:
            target_node = ox.distance.nearest_nodes(graph, seller_coords["lng"], seller_coords["lat"])
            
            # Calculate route using Dijkstra
            result = path_finder.run_dijkstra(user_node, target_node, weight='weight')
            
            if not result["path"]:
                continue

            # Decode path to coordinates with actual edge geometries
            path_coords = []
            path_nodes = result["path"]
            
            for i in range(len(path_nodes) - 1):
                u, v = path_nodes[i], path_nodes[i+1]
                # Get edge data (using first edge in case of multigraph)
                edge_data = graph.get_edge_data(u, v)[0]
                
                # If the edge has a 'geometry' attribute, use it (it's more precise)
                if 'geometry' in edge_data:
                    # geometry is a shapely LineString, extract coords
                    # Note: OSMnx geometry uses (lng, lat)
                    for x, y in list(edge_data['geometry'].coords):
                        # Avoid duplicates if they exist
                        if not path_coords or path_coords[-1] != [y, x]:
                            path_coords.append([y, x])
                else:
                    # Fallback to node coordinates if no geometry attribute
                    node_u = graph.nodes[u]
                    node_v = graph.nodes[v]
                    if not path_coords or path_coords[-1] != [node_u['y'], node_u['x']]:
                        path_coords.append([node_u['y'], node_u['x']])
                    path_coords.append([node_v['y'], node_v['x']])

            # Calculate distance (sum of edge lengths)
            total_distance_m = 0
            for i in range(len(path_nodes) - 1):
                u, v = path_nodes[i], path_nodes[i+1]
                edge_data = graph.get_edge_data(u, v)[0]
                total_distance_m += float(edge_data.get('length', 0))

            # Calcular métricas simuladas de negocio
            dist_km = total_distance_m / 1000
            
            # --- FASE 3: MOTOR DE SIMULACIÓN AVANZADO ---
            
            # 1. Determinar estado del sistema (Markov)
            # Avanzamos el estado una vez por petición de ruta para simular dinamismo
            current_state = markov_chain.next_state() 
            
            # 2. Simular Factores (Triangular)
            base_metrics = {
                "duration_min": round(result["cost"] / 60, 2),
                "distance_km": dist_km
            }
            
            factors = FactorSimulator.simulate_factors(
                state=current_state,
                base_duration_min=base_metrics["duration_min"],
                distance_km=dist_km
            )
            
            # 3. Calcular KPIs Deterministas
            kpis = KPICalculator.calculate_kpis(factors, base_metrics)

            # Costo de transporte (usando factor de combustible simulado)
            # base $2.50 + ($0.35 * fuel_factor * km)
            transport_cost = 2.50 + (dist_km * 0.35 * factors["fuel_factor"])
            
            # Precio simulado (reducido según feedback previo)
            simulated_price = product["price_per_unit"] * 0.20

            # Ingreso estimado
            estimated_revenue = (simulated_price * 100) * seller.get("demand_factor", 1.0)
            
            # Capacidad de carga
            load_percentage = 100 if dist_km < 5 else 85

            routes_result.append({
                "seller_id": seller["id"],
                "seller_name": seller["name"],
                "seller_rating": seller.get("rating", 0),
                "seller_trips": seller.get("trips_count", 0),
                "route_geometry": path_coords,
                "duration_seconds": result["cost"], 
                "distance_meters": total_distance_m,
                "distance_km": round(dist_km, 2),
                
                # Base duration for comparison
                "duration_min_base": base_metrics["duration_min"],

                # Usar duración simulada
                "duration_min": kpis["simulated_duration_min"],
                
                # Nuevos campos para dashboard
                "transport_cost": round(transport_cost, 2),
                "estimated_revenue": round(estimated_revenue, 2),
                "net_profit": round(estimated_revenue - transport_cost, 2),
                "load_percentage": load_percentage,
                "product_image": product["image_url"],
                "product_name": product["name"],
                "price_per_unit": simulated_price,
                
                # KPIs del Motor de Simulación
                "freshness_score": kpis["freshness_score"],
                "punctuality_score": kpis["punctuality_score"],
                "satisfaction_score": kpis["satisfaction_score"],
                "simulation_state": kpis["state"] # Para debug o mostrar en UI futuro
            })
            
        except Exception as e:
            print(f"Error calculating route for seller {seller['id']}: {e}")
            continue

    # Sort routes by duration (best first)
    routes_result.sort(key=lambda x: x["duration_seconds"])

    # Calculate global metrics based on best route
    best_route = routes_result[0] if routes_result else {}
    distance_km = best_route.get("distance_km", 0)
    duration_min = best_route.get("duration_min", 0)
    
    # Calculate estimated revenue and profit
    # Simplified logic: 
    # - Cost for client (revenue) = weight * price + (distance * 0.5)
    # - Profit for seller = revenue - (distance * 0.3)
    
    # Fase 2: Usar valores calculados en el loop
    product_cost = best_route.get("product_cost", 0)
    logistic_cost = best_route.get("logistic_cost", 0)
    total_cost = best_route.get("total_client_cost", 0)
    
    # --- FASE 4: Métricas del Admin ---
    admin_metrics = AdminKPICalculator.calculate_admin_metrics(routes_result)

    # Persistir KPIs y Carrera en Supabase (Simulado si no hay tabla real aún)
    try:
        # Aquí iría la inserción real en una tabla 'races_history'
        # supabase.table("races_history").insert({
        #     "seller_id": best_route["seller_id"],
        #     "total_revenue": estimated_revenue,
        #     "platform_profit": admin_metrics["platform_profit"],
        #     "kpis": kpis
        # }).execute()
        pass
    except Exception as e:
        print(f"Error persisting data: {e}")

    return {
        "recommended_route": routes_result[0] if routes_result else None,
        "all_routes": routes_result,
        "metrics": {
            "revenue": round(total_cost, 2), # Para el sistema, revenue es el costo total del pedido
            "profit": round(product_cost * 0.2, 2), # Beneficio estimado
            "distance_total": round(distance_km, 2),
            "duration_total": round(duration_min, 2),
            # Desglose Cliente
            "product_cost": round(product_cost, 2),
            "logistic_cost": round(logistic_cost, 2),
            "total_client_cost": round(total_cost, 2),
            
            # Métricas Admin
            "platform_profit": admin_metrics["platform_profit"],
            "prediction_accuracy": admin_metrics["prediction_accuracy"],
            "avg_time_reduction": admin_metrics["avg_time_reduction"],
            "revenue_growth": admin_metrics["revenue_growth"]
        }
    }

@app.get("/api/validation/stats")
async def get_validation_stats():
    """
    Endpoint para obtener métricas de validación en tiempo real.
    Ejecuta pruebas estadísticas sobre algoritmos y simulación.
    """
    if not validator_service:
         raise HTTPException(status_code=503, detail="Validation service not available")

    try:
        # 1. Validar Algoritmos (Ruteo)
        routing_stats = validator_service.validate_routing_algorithms(samples=15)
        
        # 2. Validar Simulación (Estabilidad)
        sim_stats = validator_service.validate_simulation_stability(n_simulations=100)
        
        return {
            "routing": routing_stats,
            "simulation": sim_stats,
            "timestamp": time.time()
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
