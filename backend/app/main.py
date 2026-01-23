from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time
import sys
import os
import networkx as nx
import osmnx as ox
import traceback
import math
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, confusion_matrix, roc_curve, auc, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
import joblib
from xgboost import XGBRegressor
import threading

# Add backend root to path to ensure app module is resolvable
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.dirname(current_dir) # backend
sys.path.append(backend_root)

from app.services.graph.loader import DataLoader
from app.services.routing.algorithms import PathFinder
from app.core.localdb import fetch_daily_demand
from app.core.repository import DataRepository
from app.services.simulation.engine import MarkovChain, FactorSimulator, KPICalculator, AdminKPICalculator, SimulationSessionManager, SmartRouteEngine
from app.services.validation.validator_service import ValidatorService
from app.ml.demand_forecasting.forecaster import DemandForecaster
from app.ml.eta_predictor import ETAPredictor
from app.ml.impact_predictor import ImpactPredictor
from app.core.logger import get_logger
from app.exceptions import GeoLocationError
from app.schemas import (
    RouteRequest, SimulationRequest, RecalculateRequest,
    ProductListResponse, SellerListResponse, POIListResponse,
    SimulationResponse, RecalculateResponse, ValidationStatsResponse,
    DemandForecastResponse
)

PRODUCT_IDS = ["maiz", "cacao", "arroz", "cafe", "platano", "mani", "limon", "yuca"]

from app.core.config import settings
from app.core.middleware import RequestMiddleware

logger = get_logger(__name__)
impact_predictor = ImpactPredictor()

def _warmup_impact_model():
    try:
        if not impact_predictor.model_loaded:
            impact_predictor.train_mock(n_samples=8000, n_estimators=120, max_depth=5)
            impact_predictor.force_reload()
            try:
                from app.services.simulation import engine as sim_engine

                sim_engine._impact_predictor.force_reload()
            except Exception:
                pass
    except Exception:
        pass

if "PYTEST_CURRENT_TEST" not in os.environ:
    threading.Thread(target=_warmup_impact_model, daemon=True).start()

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
        "db": "sqlite"
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


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    details = []
    for e in exc.errors():
        loc = e.get("loc") or []
        field = ".".join(str(p) for p in loc[1:]) if len(loc) > 1 else "body"
        details.append(
            {
                "field": field,
                "message": str(e.get("msg") or "Valor inválido."),
                "type": str(e.get("type") or "validation_error"),
            }
        )
    return JSONResponse(
        status_code=422,
        content={
            "error": "ValidationError",
            "message": "Solicitud inválida. Corrige los campos indicados y reintenta.",
            "details": details[:50],
        },
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
            
            # 2. Simular Factores (Base)
            raw_duration_min = float(result["cost"] / 60)
            base_metrics = {
                "duration_min": round(FactorSimulator.calibrate_base_time(dist_km, raw_duration_min), 2),
                "distance_km": dist_km
            }
            
            # 2.1 Aplicar SmartRouteEngine (Ajuste por Estado)
            smart_result = SmartRouteEngine.calculate_optimal_route(
                current_route=path_coords,
                base_duration_min=base_metrics["duration_min"],
                base_distance_km=base_metrics["distance_km"],
                state=current_state
            )
            
            factors = FactorSimulator.simulate_factors(
                state=current_state,
                base_duration_min=base_metrics["duration_min"],
                distance_km=smart_result["final_distance_km"]
            )
            
            # 3. KPIs
            # Usamos las métricas ajustadas para los KPIs
            adjusted_base_metrics = {
                "duration_min": base_metrics["duration_min"],
                "distance_km": smart_result["final_distance_km"]
            }
            kpis = KPICalculator.calculate_kpis(factors, adjusted_base_metrics)
            
            transport_cost = 2.50 + (smart_result["final_distance_km"] * 0.35 * factors["fuel_factor"])
            simulated_price = product.get("price_per_unit", 10) * 1.20
            estimated_revenue = simulated_price * float(request.weight or 0)
            load_percentage = max(0.0, min(100.0, (float(request.weight or 0) / 500.0) * 100.0))

            routes_result.append({
                "seller_id": seller["id"],
                "seller_name": seller["name"],
                "seller_rating": seller.get("rating", 0),
                "seller_trips": seller.get("trips_count", 0),
                "route_geometry": smart_result["final_route"], # Usar ruta potencialmente ajustada
                "duration_seconds": kpis["simulated_duration_min"] * 60, 
                "distance_meters": smart_result["final_distance_km"] * 1000,
                "distance_km": smart_result["final_distance_km"],
                "duration_min_base": base_metrics["duration_min"], # Original sin ajustar
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
                "efficiency_score": kpis.get("efficiency_score"),
                "emissions_kg_co2": kpis.get("emissions_kg_co2"),
                "waste_percent": kpis.get("waste_percent"),
                "energy_saving_percent": kpis.get("energy_saving_percent"),
                "simulation_state": {"state": kpis["state"].value if hasattr(kpis["state"], "value") else kpis["state"]},
                "time_adjustments": smart_result["adjustments"],
                "route_changed": smart_result["route_changed"],
                "original_duration_min": base_metrics["duration_min"]
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
            lookback_days = 365
            since = (pd.Timestamp.utcnow() - pd.Timedelta(days=lookback_days)).isoformat()
            daily = fetch_daily_demand(product_id=product.lower(), since_iso=since)
            if not daily or len(daily) < 30:
                raise HTTPException(status_code=404, detail=f"Historical demand not found for {product}")

            df = pd.DataFrame(daily, columns=["day", "y"])
            df["ds"] = pd.to_datetime(df["day"])
            df["y"] = pd.to_numeric(df["y"], errors="coerce").fillna(0.0).clip(lower=0.0)
            df = df[["ds", "y"]]
            forecaster.train(df)
            forecaster.save()
            forecaster.load()
        
        forecast = forecaster.predict(days=days)
        return {"product": product, "forecast": forecast}
    except ValueError as ve:
         raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Internal forecasting error: {str(e)}")

@app.get("/api/models/eta/evaluate")
def evaluate_eta_model(n_samples: int = 3000, sample_points: int = 300):
    predictor = ETAPredictor()
    if not predictor.model_loaded:
        raise HTTPException(status_code=503, detail="ETA model not loaded")

    n_samples = int(max(200, min(n_samples, 20000)))
    sample_points = int(max(50, min(sample_points, 1000)))

    rng = np.random.default_rng(42)

    dist = rng.uniform(1.0, 50.0, n_samples)
    speed_kmh = np.clip(rng.normal(33.0, 7.0, n_samples), 16.0, 60.0)
    base_dur = (dist / np.maximum(speed_kmh, 1e-6)) * 60.0
    base_dur = base_dur * np.clip(rng.normal(1.0, 0.05, n_samples), 0.85, 1.15)

    hour = rng.integers(6, 23, n_samples)
    day = rng.integers(0, 7, n_samples)
    is_weekend = (day >= 5).astype(int)
    is_peak_hour = (((hour >= 7) & (hour <= 9)) | ((hour >= 17) & (hour <= 19))).astype(int)

    rain = rng.choice([0, 5, 20], size=n_samples, p=[0.78, 0.17, 0.05])
    traffic = rng.beta(2.0, 2.5, n_samples)
    road_ratio = rng.uniform(0.3, 0.8, n_samples)

    traffic_effect = 0.15 + 0.85 * (1.0 - np.exp(-2.2 * traffic))
    rain_effect = np.where(rain > 0, 0.08 + (rain / 70.0), 0.0)
    peak_effect = ((is_peak_hour == 1) & (is_weekend == 0)).astype(float) * 0.28

    stop_time = np.clip(rng.lognormal(mean=np.log(1.6), sigma=0.75, size=n_samples), 0.0, 20.0)
    incident = rng.binomial(1, p=np.clip(0.02 + 0.06 * traffic + 0.03 * (rain > 0).astype(float), 0.0, 0.25), size=n_samples)
    incident_delay = incident * rng.uniform(0.0, 18.0, n_samples)
    loading_delay = np.clip(rng.normal(4.0, 3.8, n_samples), 0.0, 22.0)
    driver_style = rng.normal(0.0, 1.0, n_samples)

    multiplier = 1.0 + peak_effect + rain_effect + (traffic_effect * 0.65)
    y_true = (base_dur * multiplier) + stop_time + incident_delay + loading_delay + (driver_style * 4.0)
    y_true = np.clip(y_true, 1.0, 240.0)
    sigma = np.clip(0.13 * y_true + 1.6 * (rain > 0).astype(float) + 1.3 * traffic, 1.6, 28.0)
    y_true = np.clip(y_true + rng.normal(0.0, sigma, n_samples), 1.0, 240.0)

    X = pd.DataFrame(
        {
            "hour_of_day": hour,
            "day_of_week": day,
            "is_weekend": is_weekend,
            "distance_km": dist,
            "base_duration_min": base_dur,
            "rain_intensity": rain,
            "traffic_level": traffic,
            "is_peak_hour": is_peak_hour,
            "road_type_primary_ratio": road_ratio,
        }
    )[predictor.pipeline.feature_columns]

    y_pred = predictor.model.predict(X)

    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))

    ratio_true = y_true / np.maximum(base_dur, 1e-6)
    ratio_pred = y_pred / np.maximum(base_dur, 1e-6)
    threshold_ratio = 1.10
    y_true_cls = (ratio_true > threshold_ratio).astype(int)
    y_pred_cls = (ratio_pred > threshold_ratio).astype(int)

    tn, fp, fn, tp = confusion_matrix(y_true_cls, y_pred_cls, labels=[0, 1]).ravel()
    precision, recall, f1, _ = precision_recall_fscore_support(y_true_cls, y_pred_cls, average="binary", zero_division=0)

    fpr, tpr, thresholds = roc_curve(y_true_cls, ratio_pred)
    roc_auc = float(auc(fpr, tpr))

    idx = rng.choice(n_samples, size=sample_points, replace=False)
    points = [{"y_true": float(y_true[i]), "y_pred": float(y_pred[i])} for i in idx]

    feature_importances = None
    if hasattr(predictor.model, "feature_importances_"):
        feature_importances = [
            {"feature": f, "importance": float(v)}
            for f, v in zip(predictor.pipeline.feature_columns, predictor.model.feature_importances_)
        ]
        feature_importances.sort(key=lambda x: x["importance"], reverse=True)

    latency_ms_single = None
    try:
        sample_row = X.iloc[0:1]
        t0 = time.time()
        for _ in range(80):
            predictor.model.predict(sample_row)
        latency_ms_single = ((time.time() - t0) / 80.0) * 1000.0
    except Exception:
        latency_ms_single = None

    model_params = None
    try:
        params = predictor.model.get_params()
        model_params = {k: params.get(k) for k in ["n_estimators", "max_depth", "learning_rate", "subsample", "colsample_bytree", "reg_lambda", "reg_alpha"]}
    except Exception:
        model_params = None

    return {
        "model_loaded": True,
        "n_samples": n_samples,
        "metrics": {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": round(r2, 6)},
        "classification": {
            "label_definition": f"late_if_true_ratio_gt_{threshold_ratio}",
            "score_definition": "predicted_ratio=y_pred/base_duration_min",
            "threshold_ratio": threshold_ratio,
            "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
            "precision": round(float(precision), 6),
            "recall": round(float(recall), 6),
            "f1": round(float(f1), 6),
            "roc_auc": round(float(roc_auc), 6),
            "roc_curve": [{"fpr": float(a), "tpr": float(b)} for a, b in zip(fpr, tpr)],
        },
        "sample_points": points,
        "feature_importances": feature_importances,
        "latency_ms_single": round(float(latency_ms_single), 4) if latency_ms_single is not None else None,
        "model_params": model_params,
        "timestamp": time.time(),
    }

class ETAPredictRequest(BaseModel):
    base_duration_min: float
    distance_km: float
    weather_data: Optional[Dict[str, Any]] = None
    traffic_data: Optional[Dict[str, Any]] = None

class ETATrainMockRequest(BaseModel):
    n_samples: int = 10000
    n_estimators: int = 80
    max_depth: int = 4

@app.get("/api/models/eta/status")
def eta_model_status():
    predictor = ETAPredictor()
    return {
        "model_loaded": bool(predictor.model_loaded),
        "model_path": predictor.model_path,
        "timestamp": time.time(),
    }

@app.post("/api/models/eta/predict")
def eta_model_predict(req: ETAPredictRequest):
    predictor = ETAPredictor()
    if not predictor.model_loaded:
        raise HTTPException(status_code=503, detail="ETA model not loaded")

    predicted = predictor.predict(
        base_duration_min=float(req.base_duration_min),
        distance_km=float(req.distance_km),
        weather_data=req.weather_data or {},
        traffic_data=req.traffic_data or {},
    )
    if predicted is None:
        raise HTTPException(status_code=500, detail="ETA prediction failed")

    return {
        "predicted_duration_min": float(predicted),
        "timestamp": time.time(),
    }

@app.post("/api/models/eta/reload")
def eta_model_reload():
    predictor = ETAPredictor()
    predictor.force_reload()
    try:
        from app.services.simulation import engine as sim_engine

        sim_engine._eta_predictor.force_reload()
    except Exception:
        pass

    return {
        "model_loaded": bool(predictor.model_loaded),
        "timestamp": time.time(),
    }

@app.post("/api/models/eta/train_mock")
def eta_model_train_mock(req: ETATrainMockRequest):
    n_samples = int(max(1000, min(req.n_samples, 200000)))
    n_estimators = int(max(20, min(req.n_estimators, 500)))
    max_depth = int(max(2, min(req.max_depth, 12)))

    rng = np.random.default_rng(42)

    dist = rng.uniform(1.0, 50.0, n_samples)
    speed_kmh = np.clip(rng.normal(33.0, 7.0, n_samples), 16.0, 60.0)
    base_dur = (dist / np.maximum(speed_kmh, 1e-6)) * 60.0
    base_dur = base_dur * np.clip(rng.normal(1.0, 0.05, n_samples), 0.85, 1.15)

    hour = rng.integers(6, 23, n_samples)
    day = rng.integers(0, 7, n_samples)
    is_weekend = (day >= 5).astype(int)
    is_peak_hour = (((hour >= 7) & (hour <= 9)) | ((hour >= 17) & (hour <= 19))).astype(int)

    rain = rng.choice([0, 5, 20], size=n_samples, p=[0.78, 0.17, 0.05])
    traffic = rng.beta(2.0, 2.5, n_samples)
    road_ratio = rng.uniform(0.3, 0.8, n_samples)

    traffic_effect = 0.15 + 0.85 * (1.0 - np.exp(-2.2 * traffic))
    rain_effect = np.where(rain > 0, 0.08 + (rain / 70.0), 0.0)
    peak_effect = ((is_peak_hour == 1) & (is_weekend == 0)).astype(float) * 0.28

    stop_time = np.clip(rng.lognormal(mean=np.log(1.6), sigma=0.75, size=n_samples), 0.0, 20.0)
    incident = rng.binomial(1, p=np.clip(0.02 + 0.06 * traffic + 0.03 * (rain > 0).astype(float), 0.0, 0.25), size=n_samples)
    incident_delay = incident * rng.uniform(0.0, 18.0, n_samples)
    loading_delay = np.clip(rng.normal(4.0, 3.8, n_samples), 0.0, 22.0)
    driver_style = rng.normal(0.0, 1.0, n_samples)

    multiplier = 1.0 + peak_effect + rain_effect + (traffic_effect * 0.65)
    y_true = (base_dur * multiplier) + stop_time + incident_delay + loading_delay + (driver_style * 4.0)
    y_true = np.clip(y_true, 1.0, 240.0)
    sigma = np.clip(0.13 * y_true + 1.6 * (rain > 0).astype(float) + 1.3 * traffic, 1.6, 28.0)
    y = np.clip(y_true + rng.normal(0.0, sigma, n_samples), 1.0, 240.0)

    predictor = ETAPredictor()

    X = pd.DataFrame(
        {
            "hour_of_day": hour,
            "day_of_week": day,
            "is_weekend": is_weekend,
            "distance_km": dist,
            "base_duration_min": base_dur,
            "rain_intensity": rain,
            "traffic_level": traffic,
            "is_peak_hour": is_peak_hour,
            "road_type_primary_ratio": road_ratio,
        }
    )[predictor.pipeline.feature_columns]

    model = XGBRegressor(
        n_estimators=max(120, n_estimators),
        learning_rate=0.05,
        max_depth=max_depth,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_lambda=2.0,
        reg_alpha=0.2,
        min_child_weight=4.0,
        gamma=0.2,
        objective="reg:squarederror",
        n_jobs=-1,
        tree_method="hist",
    )

    X_train, X_tmp, y_train, y_tmp = train_test_split(X, y, test_size=0.30, random_state=42)
    X_val, X_test, y_val, y_test = train_test_split(X_tmp, y_tmp, test_size=0.50, random_state=42)

    start = time.time()
    model.fit(X_train, y_train)
    train_time_s = time.time() - start

    preds_train = model.predict(X_train)
    preds_test = model.predict(X_test)

    mae_train = float(mean_absolute_error(y_train, preds_train))
    rmse_train = float(np.sqrt(mean_squared_error(y_train, preds_train)))
    r2_train = float(r2_score(y_train, preds_train))
    mae_test = float(mean_absolute_error(y_test, preds_test))
    rmse_test = float(np.sqrt(mean_squared_error(y_test, preds_test)))
    r2_test = float(r2_score(y_test, preds_test))

    os.makedirs(os.path.dirname(predictor.model_path), exist_ok=True)
    joblib.dump(model, predictor.model_path)

    predictor.force_reload()
    try:
        from app.services.simulation import engine as sim_engine

        sim_engine._eta_predictor.force_reload()
    except Exception:
        pass

    return {
        "trained": True,
        "n_samples": n_samples,
        "params": {"n_estimators": n_estimators, "max_depth": max_depth},
        "metrics": {
            "mae": round(mae_test, 4),
            "rmse": round(rmse_test, 4),
            "r2": round(r2_test, 6),
            "train": {"mae": round(mae_train, 4), "rmse": round(rmse_train, 4), "r2": round(r2_train, 6)},
            "test": {"mae": round(mae_test, 4), "rmse": round(rmse_test, 4), "r2": round(r2_test, 6)},
            "best_iteration": int(getattr(model, "best_iteration", n_estimators)),
        },
        "train_time_s": round(train_time_s, 4),
        "model_loaded": bool(predictor.model_loaded),
        "timestamp": time.time(),
    }

@app.get("/api/models/demand/evaluate")
def evaluate_demand_model(product: str, initial: str = "180 days", period: str = "30 days", horizon: str = "30 days"):
    forecaster = DemandForecaster(product)
    if not forecaster.load():
        raise HTTPException(status_code=404, detail=f"Model for {product} not found")

    try:
        from prophet.diagnostics import cross_validation, performance_metrics
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Prophet diagnostics not available: {e}")

    try:
        df_cv = cross_validation(forecaster.model, initial=initial, period=period, horizon=horizon)
        df_p = performance_metrics(df_cv)
        metrics = df_p.mean(numeric_only=True).to_dict()

        sample = df_cv[["ds", "y", "yhat", "yhat_lower", "yhat_upper"]].tail(120).copy()
        sample_points = [
            {
                "date": row["ds"].strftime("%Y-%m-%d") if hasattr(row["ds"], "strftime") else str(row["ds"]),
                "y": float(row["y"]) if row["y"] is not None else None,
                "yhat": float(row["yhat"]) if row["yhat"] is not None else None,
                "yhat_lower": float(row["yhat_lower"]) if row["yhat_lower"] is not None else None,
                "yhat_upper": float(row["yhat_upper"]) if row["yhat_upper"] is not None else None,
            }
            for _, row in sample.iterrows()
        ]

        return {
            "model_loaded": True,
            "product": product,
            "cv": {"initial": initial, "period": period, "horizon": horizon},
            "metrics": {k: float(v) for k, v in metrics.items()},
            "sample_points": sample_points,
            "timestamp": time.time(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Demand model evaluation failed: {e}")

@app.get("/api/models/demand/evaluate_fast")
def evaluate_demand_model_fast(product: str, lookback_days: int = 365, test_days: int = 30):
    forecaster = DemandForecaster(product)
    if not forecaster.load():
        since = (pd.Timestamp.utcnow() - pd.Timedelta(days=int(max(30, min(lookback_days, 3650))))).isoformat()
        daily = fetch_daily_demand(product_id=product.lower(), since_iso=since)
        if daily and len(daily) >= 30:
            df = pd.DataFrame(daily, columns=["day", "y"])
            df["ds"] = pd.to_datetime(df["day"])
            df["y"] = pd.to_numeric(df["y"], errors="coerce").fillna(0.0).clip(lower=0.0)
            df = df[["ds", "y"]]
            forecaster.train(df)
            forecaster.save()
            forecaster.load()
        else:
            raise HTTPException(status_code=404, detail=f"Model for {product} not found")

    lookback_days = int(max(30, min(lookback_days, 3650)))
    test_days = int(max(7, min(test_days, 180)))

    df_hist = None
    try:
        product_id = product.lower()
        since = (pd.Timestamp.utcnow() - pd.Timedelta(days=lookback_days)).isoformat()
        daily = fetch_daily_demand(product_id=product_id, since_iso=since)
        if daily:
            df_hist = pd.DataFrame(daily, columns=["day", "y"])
            df_hist["ds"] = pd.to_datetime(df_hist["day"])
            df_hist["y"] = pd.to_numeric(df_hist["y"], errors="coerce").fillna(0.0).clip(lower=0.0)
            df_hist = df_hist[["ds", "y"]]
    except Exception:
        df_hist = None

    data_source = "sqlite.orders" if df_hist is not None else "model.history"
    if df_hist is None or len(df_hist) < 15:
        hist = forecaster.model.history[["ds", "y"]].copy()
        hist["ds"] = pd.to_datetime(hist["ds"])
        hist = hist.sort_values("ds")
        df_hist = hist

    test_days = int(max(7, min(test_days, max(7, len(df_hist) // 2))))
    df_test = df_hist.tail(test_days).copy()
    y_true = df_test["y"].astype(float).to_numpy()
    yhat_df = forecaster.model.predict(df_test[["ds"]])
    y_pred = np.maximum(0.0, yhat_df["yhat"].astype(float).to_numpy())

    err = y_true - y_pred
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred)) if float(np.var(y_true)) > 1e-9 else 0.0

    eps = float(max(1.0, np.percentile(np.abs(y_true), 20)))
    denom_mape = np.maximum(np.abs(y_true), eps)
    mape = float(np.mean(np.abs(err) / denom_mape)) * 100.0
    smape = float(np.mean((2.0 * np.abs(err)) / np.maximum(np.abs(y_true) + np.abs(y_pred) + eps, 1e-6))) * 100.0
    wmape = float(np.sum(np.abs(err)) / max(float(np.sum(np.abs(y_true))), eps * len(y_true))) * 100.0

    model_version = getattr(forecaster, "model_version", "")
    should_retrain = (model_version != "prophet_v3") or (mape > 160.0) or (r2 < 0.5)
    if should_retrain and df_hist is not None and len(df_hist) >= 60:
        forecaster.train(df_hist)
        forecaster.save()
        forecaster.load()
        yhat_df = forecaster.model.predict(df_test[["ds"]])
        y_pred = np.maximum(0.0, yhat_df["yhat"].astype(float).to_numpy())
        err = y_true - y_pred
        mae = float(mean_absolute_error(y_true, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        r2 = float(r2_score(y_true, y_pred)) if float(np.var(y_true)) > 1e-9 else 0.0
        eps = float(max(1.0, np.percentile(np.abs(y_true), 20)))
        denom_mape = np.maximum(np.abs(y_true), eps)
        mape = float(np.mean(np.abs(err) / denom_mape)) * 100.0
        smape = float(np.mean((2.0 * np.abs(err)) / np.maximum(np.abs(y_true) + np.abs(y_pred) + eps, 1e-6))) * 100.0
        wmape = float(np.sum(np.abs(err)) / max(float(np.sum(np.abs(y_true))), eps * len(y_true))) * 100.0

    sample = pd.DataFrame({"ds": df_test["ds"], "y": y_true, "yhat": y_pred}).tail(120)
    sample_points = [
        {"date": d.strftime("%Y-%m-%d"), "y": float(y), "yhat": float(yh)}
        for d, y, yh in zip(sample["ds"], sample["y"], sample["yhat"])
    ]

    return {
        "model_loaded": True,
        "product": product,
        "data_source": data_source,
        "window": {"lookback_days": lookback_days, "test_days": test_days},
        "metrics": {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "mape_pct": round(mape, 4),
            "smape_pct": round(smape, 4),
            "wmape_pct": round(wmape, 4),
            "r2": round(r2, 6),
        },
        "sample_points": sample_points,
        "timestamp": time.time(),
    }

@app.get("/api/models/demand/status")
def demand_models_status():
    models_dir = os.path.join(os.path.dirname(__file__), "ml", "demand_forecasting", "models")
    items = []
    for pid in PRODUCT_IDS:
        path = os.path.join(models_dir, f"prophet_{pid}.pkl")
        exists = os.path.exists(path)
        mtime = os.path.getmtime(path) if exists else None
        items.append(
            {
                "product": pid,
                "model_path": path,
                "model_file_present": exists,
                "last_modified": mtime,
            }
        )
    return {"models": items, "timestamp": time.time()}

class ImpactPredictRequest(BaseModel):
    distance_km: float
    scenario: str
    base_duration_min: Optional[float] = None

class ImpactTrainMockRequest(BaseModel):
    n_samples: int = 10000
    n_estimators: int = 120
    max_depth: int = 5

@app.get("/api/models/impact/status")
def impact_model_status():
    return {
        "model_loaded": bool(impact_predictor.model_loaded),
        "model_path": impact_predictor.model_path,
        "timestamp": time.time(),
    }

@app.post("/api/models/impact/predict")
def impact_model_predict(req: ImpactPredictRequest):
    if not impact_predictor.model_loaded:
        raise HTTPException(status_code=503, detail="Impact model not loaded")

    pred = impact_predictor.predict(
        distance_km=float(req.distance_km),
        scenario=str(req.scenario),
        base_duration_min=float(req.base_duration_min) if req.base_duration_min is not None else None,
    )
    if pred is None:
        raise HTTPException(status_code=500, detail="Impact prediction failed")

    return {"prediction": pred.to_dict(), "timestamp": time.time()}

@app.post("/api/models/impact/train_mock")
def impact_model_train_mock(req: ImpactTrainMockRequest):
    result = impact_predictor.train_mock(
        n_samples=req.n_samples,
        n_estimators=req.n_estimators,
        max_depth=req.max_depth,
    )
    impact_predictor.force_reload()
    try:
        from app.services.simulation import engine as sim_engine

        sim_engine._impact_predictor.force_reload()
    except Exception:
        pass

    return {
        **result,
        "model_loaded": bool(impact_predictor.model_loaded),
        "timestamp": time.time(),
    }

@app.get("/api/models/impact/evaluate")
def impact_model_evaluate(n_samples: int = 6000, sample_points: int = 300):
    if not impact_predictor.model_loaded:
        raise HTTPException(status_code=503, detail="Impact model not loaded")

    result = impact_predictor.evaluate_mock(n_samples=n_samples, sample_points=sample_points)
    return {**result, "timestamp": time.time()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
