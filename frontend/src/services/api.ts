import axios from 'axios';
import { POI, Product, Seller, RouteResult } from '../types';

const DEFAULT_API_URL = 'http://127.0.0.1:8000/api';
const PRIMARY_API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

const getAlternateApiUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      return parsed.toString().replace(/\/$/, '');
    }
    if (parsed.hostname === '127.0.0.1') {
      parsed.hostname = 'localhost';
      return parsed.toString().replace(/\/$/, '');
    }
    return null;
  } catch {
    return null;
  }
};

const getApiCandidates = (): string[] => {
  const primary = PRIMARY_API_URL.replace(/\/$/, '');
  const candidates = [primary];
  const alt = getAlternateApiUrl(primary);
  if (alt && alt !== primary) candidates.push(alt);
  if (DEFAULT_API_URL !== primary && DEFAULT_API_URL !== alt) candidates.push(DEFAULT_API_URL);
  return candidates;
};

const safeGetCache = <T>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const safeSetCache = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
};

const withApiFallback = async <T>(
  request: (baseUrl: string) => Promise<T>,
  cacheKey?: string
): Promise<T> => {
  const candidates = getApiCandidates();
  let lastError: unknown = null;

  for (const baseUrl of candidates) {
    try {
      const result = await request(baseUrl);
      if (cacheKey) safeSetCache(cacheKey, result);
      return result;
    } catch (err) {
      lastError = err;
    }
  }

  if (cacheKey) {
    const cached = safeGetCache<T>(cacheKey);
    if (cached !== null) {
      console.warn(`API unavailable; using cached response for ${cacheKey}`);
      return cached;
    }
  }

  throw lastError;
};

export const getProducts = async (): Promise<Product[]> => {
  return withApiFallback<Product[]>(
    async (baseUrl) => {
      const response = await axios.get(`${baseUrl}/products`);
      return response.data.products;
    },
    'cache:products'
  );
};

export const getSellers = async (productId?: string): Promise<Seller[]> => {
  const cacheKey = productId ? `cache:sellers:${productId}` : 'cache:sellers:all';
  return withApiFallback<Seller[]>(
    async (baseUrl) => {
      const url = productId ? `${baseUrl}/sellers?product_id=${productId}` : `${baseUrl}/sellers`;
      const response = await axios.get(url);
      return response.data.sellers;
    },
    cacheKey
  );
};

export const getPOIs = async (category?: string): Promise<POI[]> => {
  const cacheKey = category ? `cache:pois:${category}` : 'cache:pois:all';
  return withApiFallback<POI[]>(
    async (baseUrl) => {
      const url = category ? `${baseUrl}/pois?category=${category}` : `${baseUrl}/pois`;
      const response = await axios.get(url);
      return response.data.pois;
    },
    cacheKey
  );
};

export interface SimulationResponse {
  recommended_route: RouteResult | null;
  all_routes: RouteResult[];
  metrics: {
    revenue: number;
    profit: number;
    distance_total: number;
    duration_total: number;
  };
}

export const simulateRoutes = async (userLat: number, userLng: number, productId: string, weight: number = 100): Promise<SimulationResponse> => {
  return withApiFallback<SimulationResponse>(async (baseUrl) => {
    const response = await axios.post(`${baseUrl}/routes/simulate`, {
      user_lat: userLat,
      user_lng: userLng,
      product_id: productId,
      weight: weight
    });
    return response.data;
  });
};

export interface RecalculateResponse {
  route_geometry: [number, number][];
  distance_km: number;
  duration_min: number;
  event_applied: string;
}

export const recalculateRoute = async (
  currentLat: number, 
  currentLng: number, 
  destLat: number, 
  destLng: number, 
  eventType: string,
  simulationId?: string,
  progress?: number
): Promise<RecalculateResponse> => {
  return withApiFallback<RecalculateResponse>(async (baseUrl) => {
    const response = await axios.post(`${baseUrl}/routes/recalculate`, {
      current_lat: currentLat,
      current_lng: currentLng,
      dest_lat: destLat,
      dest_lng: destLng,
      event_type: eventType,
      simulation_id: simulationId,
      progress: progress
    });
    return response.data;
  });
};
