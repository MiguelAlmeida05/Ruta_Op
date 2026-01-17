import axios from 'axios';
import { Product, Seller, RouteResult } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const getProducts = async (): Promise<Product[]> => {
  const response = await axios.get(`${API_URL}/products`);
  return response.data.products;
};

export const getSellers = async (productId?: string): Promise<Seller[]> => {
  const url = productId ? `${API_URL}/sellers?product_id=${productId}` : `${API_URL}/sellers`;
  const response = await axios.get(url);
  return response.data.sellers;
};

export const getPOIs = async (category?: string): Promise<any[]> => {
  const url = category ? `${API_URL}/pois?category=${category}` : `${API_URL}/pois`;
  const response = await axios.get(url);
  return response.data.pois;
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
  const response = await axios.post(`${API_URL}/routes/simulate`, {
    user_lat: userLat,
    user_lng: userLng,
    product_id: productId,
    weight: weight
  });
  return response.data;
};
