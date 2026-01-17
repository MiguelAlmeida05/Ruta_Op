export interface Product {
  id: string;
  name: string;
  icon: string;
}

export interface Seller {
  id: string;
  name: string;
  type: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  products: string[];
  rating?: number;
  trips_count?: number;
}

export interface RouteResult {
  seller_id: string;
  seller_name: string;
  seller_rating?: number;
  seller_trips?: number;
  route_geometry: [number, number][]; // Array of [lat, lng]
  duration_seconds: number;
  distance_meters: number;
  distance_km: number;
  duration_min: number;
  
  // New metrics
  transport_cost?: number;
  estimated_revenue?: number;
  net_profit?: number;
  load_percentage?: number;
  product_image?: string;
  product_name?: string;
  price_per_unit?: number; // Precio unitario base
}

export interface SimulationResponse {
  recommended_route_id: string | null;
  routes: RouteResult[];
}
