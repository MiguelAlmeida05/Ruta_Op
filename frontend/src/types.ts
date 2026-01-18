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

export interface POI {
  id: string;
  name: string;
  category: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  description?: string;
  address?: string;
  opening_hours?: unknown;
  created_at?: string;
}

export interface Metrics {
  revenue?: number;
  profit?: number;
  product_cost?: number;
  logistic_cost?: number;
  total_client_cost?: number;
  platform_profit?: number;
  prediction_accuracy?: number;
  avg_time_reduction?: number;
  revenue_growth?: number;
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
  price_per_unit?: number;
  
  // Fase 2: Costos y KPIs Cliente
  product_cost?: number;
  logistic_cost?: number;
  total_client_cost?: number;
  punctuality_score?: number;
  freshness_score?: number;
  satisfaction_score?: number;
  unit?: string;
}

export interface SimulationResponse {
  recommended_route_id: string | null;
  routes: RouteResult[];
}
