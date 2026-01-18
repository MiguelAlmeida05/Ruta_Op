
import os
import sys
import json

# Add backend to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.dirname(current_dir)
sys.path.append(backend_root)

from api.supabase_client import get_supabase
# from scripts.image_system import process_coffee_image_request, ImageCleaner # Removed complex system

def update_data():
    supabase = get_supabase()
    print("Conectado a Supabase...")

    # 1. Limpiar POIs (Puntos irrelevantes)
    print("Limpiando POIs...")
    try:
        supabase.table("pois").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    except Exception as e:
        print(f"Nota sobre POIs: {e}")

    # 2. Productos
    print("Actualizando Productos con rutas de imágenes locales (Manual)...")
    
    # Rutas estáticas para que el usuario suba sus fotos a frontend/public/assets/products/
    products = [
        # Existentes
        {"id": "maiz", "name": "Maíz", "icon": "corn", "image_url": "/assets/products/maiz.jpg", "price_per_unit": 15.50, "unit": "qq"},
        {"id": "cacao", "name": "Cacao", "icon": "bean", "image_url": "/assets/products/cacao.jpg", "price_per_unit": 120.00, "unit": "qq"},
        {"id": "cebolla", "name": "Cebolla", "icon": "onion", "image_url": "/assets/products/cebolla.jpg", "price_per_unit": 25.00, "unit": "saco"},
        {"id": "arroz", "name": "Arroz", "icon": "rice", "image_url": "/assets/products/arroz.jpg", "price_per_unit": 38.00, "unit": "saco"},
        {"id": "platano", "name": "Plátano", "icon": "banana", "image_url": "/assets/products/platano.jpg", "price_per_unit": 8.50, "unit": "racimo"},
        {"id": "pitahaya", "name": "Pitahaya", "icon": "dragonfruit", "image_url": "/assets/products/pitahaya.jpg", "price_per_unit": 4.50, "unit": "kg"},
        # Nuevos
        {"id": "mani", "name": "Maní", "icon": "nut", "image_url": "/assets/products/mani.jpg", "price_per_unit": 18.00, "unit": "qq"},
        {"id": "cafe", "name": "Café", "icon": "coffee", "image_url": "/assets/products/cafe.jpg", "price_per_unit": 45.00, "unit": "qq"},
        {"id": "yuca", "name": "Yuca", "icon": "carrot", "image_url": "/assets/products/yuca.jpg", "price_per_unit": 12.00, "unit": "saco"},
        {"id": "limon", "name": "Limón", "icon": "lemon", "image_url": "/assets/products/limon.jpg", "price_per_unit": 10.00, "unit": "saco"}
    ]

    for p in products:
        supabase.table("products").upsert(p).execute()


    # 3. Distribuidores (10 Total: 5 Urbanos, 5 Rurales/Periurbanos)
    print("Actualizando Distribuidores...")
    
    # Coordenadas aproximadas
    # Urbano (Centro y alrededores)
    coord_mercado_central = {"lat": -1.0547, "lng": -80.4525}
    coord_el_granjero = {"lat": -1.0505, "lng": -80.4612}
    coord_dona_maria = {"lat": -1.0612, "lng": -80.4425}
    coord_mercado_2 = {"lat": -1.0455, "lng": -80.4558}
    coord_dist_centro = {"lat": -1.0515, "lng": -80.4505}
    
    # Rural / Periferia
    coord_calderon = {"lat": -1.0400, "lng": -80.3500} # Calderón (ajustado para no salir del grafo si es pequeño) -> Usaremos algo más cerca si el grafo es solo urbano.
    # Nota: Si el grafo es solo de la ciudad, coordenadas muy lejanas fallarán en el ruteo. 
    # Asumiré que el grafo tiene cierto margen. Usaré coordenadas periurbanas seguras.
    coord_norte_periurbano = {"lat": -1.0250, "lng": -80.4400} # Salida a Crucita
    coord_sur_colon = {"lat": -1.0800, "lng": -80.4450} # Colón
    coord_este_riochico = {"lat": -1.0500, "lng": -80.4000} # Vía a Riochico
    coord_oeste_picoaza = {"lat": -1.0350, "lng": -80.4800} # Picoazá
    coord_san_placido = {"lat": -1.0600, "lng": -80.3800} # Hacia San Plácido

    sellers = [
        # Urbanos (5)
        {"id": "mercado_1", "name": "Mercado Central", "type": "Mercado", "coordinates": coord_mercado_central, "products": ["maiz", "cebolla", "arroz", "platano", "pitahaya", "mani"], "demand_factor": 1.2, "rating": 4.8, "trips_count": 156},
        {"id": "mayorista_1", "name": "Comercial El Granjero", "type": "Mayorista", "coordinates": coord_el_granjero, "products": ["maiz", "cacao", "arroz", "cafe"], "demand_factor": 1.5, "rating": 4.5, "trips_count": 89},
        {"id": "minorista_1", "name": "Tienda Doña María", "type": "Minorista", "coordinates": coord_dona_maria, "products": ["cebolla", "platano", "pitahaya", "limon", "yuca"], "demand_factor": 0.8, "rating": 4.9, "trips_count": 210},
        {"id": "mercado_2", "name": "Mercado No. 2", "type": "Mercado", "coordinates": coord_mercado_2, "products": ["cacao", "cebolla", "arroz", "pitahaya", "mani", "limon"], "demand_factor": 1.1, "rating": 4.2, "trips_count": 45},
        {"id": "vendedor_centro", "name": "Distribuidora Centro", "type": "Mayorista", "coordinates": coord_dist_centro, "products": ["maiz", "cacao", "cebolla", "arroz", "platano", "cafe"], "demand_factor": 1.3, "rating": 3.5, "trips_count": 10},

        # Rurales / Periurbanos (5) - Reemplazando/Renombrando algunos existentes y añadiendo nuevos
        # Reutilizando IDs existentes donde sea posible para no dejar basura, o creando nuevos.
        {"id": "vendedor_norte", "name": "Agro Calderón (Rural)", "type": "Productor", "coordinates": coord_norte_periurbano, "products": ["maiz", "arroz", "pitahaya", "mani", "yuca"], "demand_factor": 0.9, "rating": 4.7, "trips_count": 12},
        {"id": "vendedor_sur", "name": "Finca Colón (Rural)", "type": "Productor", "coordinates": coord_sur_colon, "products": ["cebolla", "platano", "cacao", "limon", "cafe"], "demand_factor": 1.0, "rating": 4.6, "trips_count": 78},
        
        # Nuevos Rurales
        {"id": "rural_riochico", "name": "Cooperativa Riochico", "type": "Productor", "coordinates": coord_este_riochico, "products": ["cacao", "cafe", "platano", "limon"], "demand_factor": 1.4, "rating": 4.9, "trips_count": 5},
        {"id": "rural_picoaza", "name": "Huertos de Picoazá", "type": "Minorista", "coordinates": coord_oeste_picoaza, "products": ["cebolla", "mani", "maiz", "yuca"], "demand_factor": 1.1, "rating": 4.3, "trips_count": 22},
        {"id": "rural_san_placido", "name": "Asoc. San Plácido", "type": "Productor", "coordinates": coord_san_placido, "products": ["platano", "cacao", "pitahaya", "cafe"], "demand_factor": 1.2, "rating": 4.8, "trips_count": 15}
    ]

    for s in sellers:
        # Usamos upsert para actualizar existentes o crear nuevos
        supabase.table("sellers").upsert(s).execute()

    print("Datos actualizados correctamente.")

if __name__ == "__main__":
    update_data()
