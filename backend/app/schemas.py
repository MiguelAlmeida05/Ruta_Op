from pydantic import BaseModel
from typing import List, Optional, Dict, Any

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
    session_id: Optional[str] = None

class RecalculateRequest(BaseModel):
    current_lat: float
    current_lng: float
    dest_lat: float
    dest_lng: float
    event_type: str
    simulation_id: Optional[str] = None
    session_id: Optional[str] = None
    progress: Optional[float] = 0.0
    vehicle_weight: Optional[float] = None

class Coordinates(BaseModel):
    lat: float
    lng: float

class Product(BaseModel):
    id: str
    name: str
    icon: str
    image_url: Optional[str] = None
    price_per_unit: Optional[float] = None
    unit: Optional[str] = None

class Seller(BaseModel):
    id: str
    name: str
    products: List[str]
    coordinates: Coordinates
    rating: Optional[float] = None
    trips_count: Optional[int] = None
    type: Optional[str] = "distributor"

class POI(BaseModel):
    id: str
    name: str
    category: str
    coordinates: Coordinates
    description: Optional[str] = None
    address: Optional[str] = None
    created_at: Optional[str] = None

class RouteResult(BaseModel):
    seller_id: str
    seller_name: str
    seller_rating: float = 0
    seller_trips: int = 0
    route_geometry: List[List[float]] # [[lat, lng], ...]
    duration_seconds: float
    distance_meters: float
    distance_km: float
    duration_min_base: Optional[float] = None
    duration_min: float
    stop_time_min: Optional[float] = None
    route_valid: Optional[bool] = None
    transport_cost: Optional[float] = None
    estimated_revenue: Optional[float] = None
    net_profit: Optional[float] = None
    load_percentage: Optional[float] = None
    product_image: Optional[str] = None
    product_name: Optional[str] = None
    price_per_unit: Optional[float] = None
    freshness_score: Optional[float] = None
    punctuality_score: Optional[float] = None
    satisfaction_score: Optional[float] = None
    simulation_state: Optional[Dict[str, Any]] = None
    time_adjustments: Optional[List[str]] = None # Desglose de ajustes (e.g. "+15 min por Lluvia")
    route_changed: Optional[bool] = False
    original_duration_min: Optional[float] = None

class SimulationMetrics(BaseModel):
    revenue: float
    profit: float
    distance_total: float
    duration_total: float
    platform_profit: float
    prediction_accuracy: float
    avg_time_reduction: float
    revenue_growth: float

class SimulationResponse(BaseModel):
    session_id: Optional[str] = None
    recommended_route: Optional[RouteResult] = None
    all_routes: List[RouteResult]
    metrics: SimulationMetrics
    timestamp: float

class ProductListResponse(BaseModel):
    products: List[Product]

class SellerListResponse(BaseModel):
    sellers: List[Seller]

class POIListResponse(BaseModel):
    pois: List[POI]

class RecalculateResponse(BaseModel):
    route_geometry: List[List[float]]
    distance_km: float
    duration_min: float
    duration_seconds: float
    event_applied: str
    timestamp: float

class ValidationStatsResponse(BaseModel):
    routing: Dict[str, Any]
    simulation: Dict[str, Any]
    timestamp: float

class DemandForecastResponse(BaseModel):
    product: str
    forecast: List[Dict[str, Any]]
