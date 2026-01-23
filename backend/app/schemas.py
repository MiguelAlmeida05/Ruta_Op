from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any, Literal

ALLOWED_PRODUCT_IDS = {"maiz", "cacao", "arroz", "cafe", "platano", "mani", "limon", "yuca"}
ALLOWED_EVENT_TYPES = {"rain", "traffic", "protest"}
ALLOWED_ROUTE_MODES = {"driving"}

class RouteRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90.0, le=90.0, description="Latitud de origen (WGS84).")
    origin_lng: float = Field(..., ge=-180.0, le=180.0, description="Longitud de origen (WGS84).")
    dest_lat: float = Field(..., ge=-90.0, le=90.0, description="Latitud de destino (WGS84).")
    dest_lng: float = Field(..., ge=-180.0, le=180.0, description="Longitud de destino (WGS84).")
    mode: str = Field("driving", description="Modo de ruteo.")

    @field_validator("mode")
    @classmethod
    def _validate_mode(cls, v: str) -> str:
        if not isinstance(v, str) or not v.strip():
            raise ValueError("mode es requerido.")
        vv = v.strip().lower()
        if vv not in ALLOWED_ROUTE_MODES:
            raise ValueError(f"mode inválido. Valores permitidos: {sorted(ALLOWED_ROUTE_MODES)}")
        return vv

class SimulationRequest(BaseModel):
    user_lat: float = Field(..., ge=-90.0, le=90.0, description="Latitud del usuario (WGS84).")
    user_lng: float = Field(..., ge=-180.0, le=180.0, description="Longitud del usuario (WGS84).")
    product_id: str = Field(..., description="ID de producto a simular.")
    weight: float = Field(1.0, gt=0.0, description="Peso (kg) solicitado.")
    session_id: Optional[str] = None

    @field_validator("product_id")
    @classmethod
    def _validate_product_id(cls, v: str) -> str:
        if not isinstance(v, str) or not v.strip():
            raise ValueError("product_id es requerido.")
        vv = v.strip().lower()
        if vv not in ALLOWED_PRODUCT_IDS:
            raise ValueError(f"product_id inválido. Valores permitidos: {sorted(ALLOWED_PRODUCT_IDS)}")
        return vv

class RecalculateRequest(BaseModel):
    current_lat: float = Field(..., ge=-90.0, le=90.0, description="Latitud actual (WGS84).")
    current_lng: float = Field(..., ge=-180.0, le=180.0, description="Longitud actual (WGS84).")
    dest_lat: float = Field(..., ge=-90.0, le=90.0, description="Latitud destino (WGS84).")
    dest_lng: float = Field(..., ge=-180.0, le=180.0, description="Longitud destino (WGS84).")
    event_type: str = Field(..., description="Tipo de evento a aplicar en el ruteo.")
    simulation_id: Optional[str] = None
    session_id: Optional[str] = None
    progress: Optional[float] = Field(0.0, ge=0.0, le=1.0, description="Progreso de la ruta (0..1).")
    vehicle_weight: Optional[float] = Field(None, gt=0.0, description="Peso del vehículo/carga (kg).")

    @field_validator("event_type")
    @classmethod
    def _validate_event_type(cls, v: str) -> str:
        if not isinstance(v, str) or not v.strip():
            raise ValueError("event_type es requerido.")
        vv = v.strip().lower()
        if vv in ("strike", "paro", "paros"):
            vv = "protest"
        if vv not in ALLOWED_EVENT_TYPES:
            raise ValueError(f"event_type inválido. Valores permitidos: {sorted(ALLOWED_EVENT_TYPES)}")
        return vv

class Coordinates(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)

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
    efficiency_score: Optional[float] = None
    emissions_kg_co2: Optional[float] = None
    waste_percent: Optional[float] = None
    energy_saving_percent: Optional[float] = None
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
