from typing import List, Dict, Optional, Any
from app.core.localdb import fetch_product_by_id, fetch_products, fetch_sellers, log_simulation_event, seed_if_empty
from app.core.logger import get_logger

logger = get_logger(__name__)

# Mock Data for Fallback
MOCK_PRODUCTS = [
    {"id": "maiz", "name": "Maíz", "icon": "corn", "image_url": "/assets/products/maiz.jpg", "price_per_unit": 15.50, "unit": "qq"},
    {"id": "cacao", "name": "Cacao", "icon": "bean", "image_url": "/assets/products/cacao.jpg", "price_per_unit": 120.00, "unit": "qq"},
    {"id": "arroz", "name": "Arroz", "icon": "rice", "image_url": "/assets/products/arroz.jpg", "price_per_unit": 38.00, "unit": "saco"},
    {"id": "cafe", "name": "Café", "icon": "coffee", "image_url": "/assets/products/cafe.jpg", "price_per_unit": 180.00, "unit": "qq"},
    {"id": "platano", "name": "Plátano", "icon": "banana", "image_url": "/assets/products/platano.jpg", "price_per_unit": 6.50, "unit": "racimo"},
    {"id": "mani", "name": "Maní", "icon": "nut", "image_url": "/assets/products/mani.jpg", "price_per_unit": 25.00, "unit": "saco"},
    {"id": "limon", "name": "Limón", "icon": "citrus", "image_url": "/assets/products/limon.jpg", "price_per_unit": 12.00, "unit": "malla"},
    {"id": "yuca", "name": "Yuca", "icon": "root", "image_url": "/assets/products/yuca.jpg", "price_per_unit": 18.00, "unit": "saco"}
]

MOCK_SELLERS = [
    {"id": "seller1", "name": "Distribuidora Central", "products": ["maiz", "arroz", "mani"], "coordinates": {"lat": -1.0544, "lng": -80.4544}, "rating": 4.5, "trips_count": 120, "type": "Mayorista"},
    {"id": "seller2", "name": "Agro Portoviejo", "products": ["cacao", "cafe"], "coordinates": {"lat": -1.0400, "lng": -80.4600}, "rating": 4.8, "trips_count": 85, "type": "Cooperativa"},
    {"id": "seller3", "name": "Comercial Manabí", "products": ["platano", "yuca", "limon"], "coordinates": {"lat": -1.0600, "lng": -80.4400}, "rating": 4.2, "trips_count": 200, "type": "Mayorista"},
    {"id": "seller4", "name": "Frutas del Valle", "products": ["limon", "platano"], "coordinates": {"lat": -1.0350, "lng": -80.4700}, "rating": 4.6, "trips_count": 95, "type": "Productor"},
    {"id": "seller5", "name": "Granos Selectos", "products": ["maiz", "mani", "arroz"], "coordinates": {"lat": -1.0450, "lng": -80.4300}, "rating": 4.9, "trips_count": 150, "type": "Exportador"},
    {"id": "seller6", "name": "Asoc. Campesina", "products": ["cacao", "cafe", "yuca"], "coordinates": {"lat": -1.0700, "lng": -80.4500}, "rating": 4.0, "trips_count": 60, "type": "Asociación"},
    {"id": "seller7", "name": "Mercado Mayorista", "products": ["arroz", "maiz", "platano", "limon"], "coordinates": {"lat": -1.0500, "lng": -80.4650}, "rating": 3.8, "trips_count": 300, "type": "Mercado"},
    {"id": "seller8", "name": "Agroinsumos del Sur", "products": ["mani", "cacao"], "coordinates": {"lat": -1.0800, "lng": -80.4450}, "rating": 4.7, "trips_count": 110, "type": "Distribuidor"},
    {"id": "seller9", "name": "BioFrutas", "products": ["limon", "platano", "yuca"], "coordinates": {"lat": -1.0250, "lng": -80.4550}, "rating": 4.9, "trips_count": 45, "type": "Orgánico"},
    {"id": "seller10", "name": "Centro de Acopio Norte", "products": ["maiz", "arroz"], "coordinates": {"lat": -1.0300, "lng": -80.4800}, "rating": 4.3, "trips_count": 180, "type": "Acopio"}
]

class DataRepository:
    def __init__(self):
        seed_if_empty(MOCK_PRODUCTS, MOCK_SELLERS)
        logger.info("Repository initialized in LOCAL DB mode (SQLite).")

    def get_products(self) -> List[Dict[str, Any]]:
        try:
            return fetch_products()
        except Exception as e:
            logger.error(f"Local DB error fetching products: {e}. Falling back to mock data.")
            return MOCK_PRODUCTS

    def get_product_by_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        try:
            found = fetch_product_by_id(product_id)
            if found:
                return found
        except Exception as e:
            logger.error(f"Local DB error fetching product {product_id}: {e}")

        return next((p for p in MOCK_PRODUCTS if p["id"] == product_id), None)

    def get_sellers(self, product_id: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            return fetch_sellers(product_id=product_id)
        except Exception as e:
            logger.error(f"Local DB error fetching sellers: {e}. Falling back to mock data.")
            if product_id:
                return [s for s in MOCK_SELLERS if product_id in s["products"]]
            return MOCK_SELLERS

    def get_pois(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        return []

    def log_simulation_event(self, event_data: Dict[str, Any]):
        try:
            log_simulation_event(str(event_data.get("event_type") or "unknown"), event_data)
        except Exception as e:
            logger.error(f"Failed to log event to Local DB: {e}")
