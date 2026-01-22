from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time
import sys
import os
import networkx as nx
import osmnx as ox
import traceback
import math

# Add backend root to path to ensure app module is resolvable
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir) # backend/app
backend_root = os.path.dirname(app_dir) # backend
sys.path.append(backend_root)

from app.services.graph.loader import DataLoader
from app.services.routing.algorithms import PathFinder
from app.core.database import get_supabase
from app.core.repository import DataRepository
from app.services.simulation.engine import MarkovChain, FactorSimulator, KPICalculator, AdminKPICalculator, SimulationSessionManager
from app.services.validation.validator_service import ValidatorService
from app.ml.demand_forecasting.forecaster import DemandForecaster
from app.core.logger import get_logger
from app.exceptions import GeoLocationError
from app.schemas import (
    RouteRequest, SimulationRequest, RecalculateRequest,
    ProductListResponse, SellerListResponse, POIListResponse,
    SimulationResponse, RecalculateResponse, ValidationStatsResponse,
    DemandForecastResponse
)

from app.core.config import settings
from app.core.middleware import RequestMiddleware

logger = get_logger(__name__)

app = FastAPI(title="TuDistri API", description="API for Portoviejo Route Optimization", version="1.0.0")

# Add Request Middleware
app.add_middleware(RequestMiddleware)

@app.exception_handler(GeoLocationError)
async def geolocation_exception_handler(request: Request, exc: GeoLocationError):
    logger.error(f"GeoLocationError: {exc.message} - Details: {exc.details}")
    return JSONResponse(
        status_code=400,
        content={
            "error": "GeoLocationError",
            "message": exc.message,
            "details": exc.details,
            "timestamp": time.time()
        },
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_details = traceback.format_exc()
    logger.error(f"Unhandled Exception: {str(exc)}\n{error_details}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred.",
            "timestamp": time.time()
        },
    )

supabase = get_supabase()

# CORS Configuration
origins = settings.BACKEND_CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
graph = None
path_finder = None
session_manager = SimulationSessionManager()
validator_service = None
markov_chain = MarkovChain() # Default chain for stateless requests
repository = None

@app.on_event("startup")
async def startup_event():
    global graph, path_finder, validator_service, repository
    logger.info("Loading graph...")
    # Initialize repository
    repository = DataRepository()
    
    # Data dir is parallel to backend in Ruta_Op/data
    project_root = os.path.dirname(backend_root)
    data_dir = os.path.join(project_root, 'data')
    
    loader = DataLoader(data_dir=data_dir)
    try:
        graph = loader.load_graph()
        if graph is None:
            raise ValueError("Graph loader returned None")
        path_finder = PathFinder(graph)
        validator_service = ValidatorService(graph, path_finder)
        logger.info(f"Graph loaded successfully with {len(graph.nodes)} nodes!")
    except Exception as e:
        logger.error(f"CRITICAL ERROR loading graph: {e}")
        graph = None
        path_finder = None

@app.get("/health")
def health_check():
    return {
        "status": "ok" if graph is not None else "degraded",
        "graph_loaded": graph is not None,
        "supabase_connected": supabase is not None
    }

@app.post("/api/routes/recalculate", response_model=RecalculateResponse)
def recalculate_route(request: RecalculateRequest):
    if graph is None:
        raise HTTPException(status_code=503, detail="Graph service not available")

    try:
        start_node = ox.distance.nearest_nodes(graph, request.current_lng, request.current_lat)
        end_node = ox.distance.nearest_nodes(graph, request.dest_lng, request.dest_lat)
    except Exception as e:
        raise GeoLocationError(
            message="Error finding nodes for recalculation",
            details=str(e)
        )

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

    # Persist event
    if request.simulation_id:
        try:
            repository.log_simulation_event({
                "simulation_id": request.simulation_id,
                "event_type": request.event_type,
                "trigger_location": {"lat": request.current_lat, "lng": request.current_lng},
                "trigger_progress": request.progress,
                "impact_metrics": {
                    "distance_added": total_distance_m,
                    "new_duration": round(result["cost"] / 60, 2)
                }
            })
        except Exception as e:
            logger.error(f"Failed to log event: {e}")

    return {
        "route_geometry": path_coords,
        "distance_km": total_distance_m / 1000,
        "duration_min": round(result["cost"] / 60, 2),
        "duration_seconds": result["cost"],
        "event_applied": request.event_type,
        "timestamp": time.time()
    }

@app.get("/")
def root():
    return {"message": "Welcome to TuDistri API (Refactored)"}

@app.get("/api/products", response_model=ProductListResponse)
def get_products():
    return {"products": repository.get_products()}

@app.get("/api/sellers", response_model=SellerListResponse)
def get_sellers(product_id: Optional[str] = None):
    return {"sellers": repository.get_sellers(product_id)}

@app.get("/api/pois", response_model=POIListResponse)
async def get_pois(category: Optional[str] = None):
    return {"pois": repository.get_pois(category)}

@app.post("/api/routes/simulate", response_model=SimulationResponse)
def simulate_routes(request: SimulationRequest):
    if graph is None:
        raise HTTPException(status_code=503, detail="Graph service not available")

    # Get product
    product = repository.get_product_by_id(request.product_id)
    if not product:
        # If product not found even in mock, return empty routes or handle gracefully
        # But repository ensures mock fallback, so product should exist if ID is valid mock ID
        # If ID is totally unknown, we might want to return error or use generic fallback
        product = {"price_per_unit": 50, "unit": "kg", "name": "Producto", "image_url": ""}

    # Get sellers
    sellers = repository.get_sellers(request.product_id)
    
    if not sellers:
        return {
            "session_id": request.session_id,
            "recommended_route": None,
            "all_routes": [],
            "metrics": {
                "revenue": 0.0,
                "profit": 0.0,
                "distance_total": 0.0,
                "duration_total": 0.0,
                "platform_profit": 0.0,
                "prediction_accuracy": 0.0,
                "avg_time_reduction": 0.0,
                "revenue_growth": 0.0
            },
            "timestamp": time.time()
        }

    routes_result = []
    
    try:
        user_node = ox.distance.nearest_nodes(graph, request.user_lng, request.user_lat)
    except Exception as e:
        raise GeoLocationError(
            message="Error finding user location on map",
            details=str(e)
        )

    # Use session if provided, else default chain
    chain = markov_chain
    if request.session_id:
        chain = session_manager.get_session(request.session_id)

    # 1. Determinar estado del sistema (Markov)
    # Avanzamos el estado una vez por petición (global o sesión)
    current_state = chain.next_state() 

    for seller in sellers:
        seller_coords = seller["coordinates"]
        try:
            target_node = ox.distance.nearest_nodes(graph, seller_coords["lng"], seller_coords["lat"])
            result = path_finder.run_dijkstra(user_node, target_node, weight='weight')
            
            if not result["path"]: continue
            
            # Validate result cost
            if math.isinf(result["cost"]) or math.isnan(result["cost"]):
                logger.warning(f"Invalid routing cost for seller {seller['id']}: {result['cost']}")
                continue

            # Decode path
            path_coords = []
            path_nodes = result["path"]
            total_distance_m = 0
            for i in range(len(path_nodes) - 1):
                u, v = path_nodes[i], path_nodes[i+1]
                edge_data = graph.get_edge_data(u, v)[0]
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

            dist_km = total_distance_m / 1000
            
            # 2. Simular Factores
            base_metrics = {
                "duration_min": round(result["cost"] / 60, 2),
                "distance_km": dist_km
            }
            
            factors = FactorSimulator.simulate_factors(
                state=current_state,
                base_duration_min=base_metrics["duration_min"],
                distance_km=dist_km
            )
            
            # 3. KPIs
            kpis = KPICalculator.calculate_kpis(factors, base_metrics)
            transport_cost = 2.50 + (dist_km * 0.35 * factors["fuel_factor"])
            simulated_price = product.get("price_per_unit", 10) * 0.20
            estimated_revenue = (simulated_price * 100) * seller.get("demand_factor", 1.0)
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
                "duration_min_base": base_metrics["duration_min"],
                "duration_min": kpis["simulated_duration_min"],
                "transport_cost": round(transport_cost, 2),
                "estimated_revenue": round(estimated_revenue, 2),
                "net_profit": round(estimated_revenue - transport_cost, 2),
                "load_percentage": load_percentage,
                "product_image": product.get("image_url", ""),
                "product_name": product.get("name", "Unknown"),
                "price_per_unit": simulated_price,
                "freshness_score": kpis["freshness_score"],
                "punctuality_score": kpis["punctuality_score"],
                "satisfaction_score": kpis["satisfaction_score"],
                "simulation_state": {"state": kpis["state"].value if hasattr(kpis["state"], "value") else kpis["state"]}
            })
            
        except Exception as e:
            logger.error(f"Error calculating route for seller {seller.get('id')}: {e}")
            continue

    routes_result.sort(key=lambda x: x["duration_seconds"])

    # Metrics aggregation
    best_route = routes_result[0] if routes_result else {}
    admin_metrics = AdminKPICalculator.calculate_admin_metrics(routes_result)

    return {
        "session_id": request.session_id,
        "recommended_route": routes_result[0] if routes_result else None,
        "all_routes": routes_result,
        "metrics": {
            "revenue": round(best_route.get("estimated_revenue", 0), 2),
            "profit": round(best_route.get("net_profit", 0), 2),
            "distance_total": round(best_route.get("distance_km", 0), 2),
            "duration_total": round(best_route.get("duration_min", 0), 2),
            "platform_profit": admin_metrics["platform_profit"],
            "prediction_accuracy": admin_metrics["prediction_accuracy"],
            "avg_time_reduction": admin_metrics["avg_time_reduction"],
            "revenue_growth": admin_metrics["revenue_growth"]
        },
        "timestamp": time.time()
    }

@app.get("/api/validation/stats", response_model=ValidationStatsResponse)
def get_validation_stats():
    if not validator_service:
         raise HTTPException(status_code=503, detail="Validation service not available")

    try:
        routing_stats = validator_service.validate_routing_algorithms(samples=15)
        sim_stats = validator_service.validate_simulation_stability(n_simulations=100)
        return {
            "routing": routing_stats,
            "simulation": sim_stats,
            "timestamp": time.time()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@app.get("/api/demand/forecast", response_model=DemandForecastResponse)
def get_demand_forecast(product: str, days: int = 7):
    try:
        forecaster = DemandForecaster(product)
        if not forecaster.load():
            raise HTTPException(status_code=404, detail=f"Model for {product} not found. Please run training script first.")
        
        forecast = forecaster.predict(days=days)
        return {"product": product, "forecast": forecast}
    except ValueError as ve:
         raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Internal forecasting error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
