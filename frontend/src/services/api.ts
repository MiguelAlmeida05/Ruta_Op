import axios from 'axios';
import { POI, Product, Seller, SimulationResponse } from '../types';
import { config } from '../config';
import type { DemandModelsStatusResponse, DemandModelEvaluationFastResponse, DemandModelEvaluationResponse, EtaModelEvaluationResponse, EtaModelPredictResponse, EtaModelStatusResponse, EtaModelTrainMockResponse, ImpactEvaluateResponse, ImpactModelStatusResponse, ImpactPredictResponse, ImpactTrainMockResponse, ValidationStatsResponse } from '../types/modelEvaluation';
import { parseValidationStatsResponse } from '../validation/validationStats';
import { assertClientValid, validateEventType, validateLatLng, validateProductId, validateProgress, validateWeightKg } from '../validation/requestValidation';

const DEFAULT_API_URL = 'http://127.0.0.1:8000/api';
const PRIMARY_API_URL = config.API_URL || DEFAULT_API_URL;

export class ApiError extends Error {
  requestId?: string;
  originalError?: unknown;

  constructor(message: string, requestId?: string, originalError?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.requestId = requestId;
    this.originalError = originalError;
  }
}

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
      // Notificamos que estamos usando cache (podría hacerse via store, pero api.ts es agnóstico de react)
      // En una implementación más avanzada, podríamos inyectar el notificador o usar eventos
      return cached;
    }
  }

  // Si llegamos aquí, todo falló
  let requestId: string | undefined;
  let message = 'Unknown API Error';

  if (axios.isAxiosError(lastError)) {
    requestId = lastError.response?.headers['x-request-id'];
    message = lastError.message;
  } else if (lastError instanceof Error) {
    message = lastError.message;
  }

  throw new ApiError(message, requestId, lastError);
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

export const simulateRoutes = async (userLat: number, userLng: number, productId: string, weight: number = 100): Promise<SimulationResponse> => {
  const errors = [...validateLatLng(userLat, userLng), ...validateProductId(productId), ...validateWeightKg(weight)];
  assertClientValid(errors, (m) => new ApiError(m));
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
  const errors = [
    ...validateLatLng(currentLat, currentLng),
    ...validateLatLng(destLat, destLng),
    ...validateEventType(eventType),
    ...validateProgress(progress)
  ];
  assertClientValid(errors, (m) => new ApiError(m));
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

export const getValidationStats = async (): Promise<ValidationStatsResponse> => {
  return withApiFallback<ValidationStatsResponse>(async (baseUrl) => {
    const response = await axios.get(`${baseUrl}/validation/stats`);
    const parsed = parseValidationStatsResponse(response.data);
    if (!parsed.ok) {
      const msg = ('errors' in parsed ? parsed.errors : []).slice(0, 6).join(' ');
      throw new ApiError(`Respuesta inválida desde /api/validation/stats. ${msg}`);
    }
    return parsed.value;
  });
};

export const evaluateEtaModel = async (params?: { n_samples?: number; sample_points?: number }): Promise<EtaModelEvaluationResponse> => {
  return withApiFallback<EtaModelEvaluationResponse>(async (baseUrl) => {
    const response = await axios.get(`${baseUrl}/models/eta/evaluate`, { params });
    return response.data;
  });
};

export const getEtaModelStatus = async (): Promise<EtaModelStatusResponse> => {
  return withApiFallback<EtaModelStatusResponse>(async (baseUrl) => {
    const response = await axios.get(`${baseUrl}/models/eta/status`);
    return response.data;
  });
};

export const predictEta = async (body: {
  base_duration_min: number;
  distance_km: number;
  weather_data?: Record<string, unknown>;
  traffic_data?: Record<string, unknown>;
}): Promise<EtaModelPredictResponse> => {
  return withApiFallback<EtaModelPredictResponse>(async (baseUrl) => {
    const response = await axios.post(`${baseUrl}/models/eta/predict`, body);
    return response.data;
  });
};

export const reloadEtaModel = async (): Promise<EtaModelStatusResponse> => {
  return withApiFallback<EtaModelStatusResponse>(async (baseUrl) => {
    const response = await axios.post(`${baseUrl}/models/eta/reload`);
    return response.data;
  });
};

export const trainEtaModelMock = async (body?: { n_samples?: number; n_estimators?: number; max_depth?: number }): Promise<EtaModelTrainMockResponse> => {
  return withApiFallback<EtaModelTrainMockResponse>(async (baseUrl) => {
    const response = await axios.post(`${baseUrl}/models/eta/train_mock`, body || {});
    return response.data;
  });
};

export const evaluateDemandModel = async (params: { product: string; initial?: string; period?: string; horizon?: string }): Promise<DemandModelEvaluationResponse> => {
  return withApiFallback<DemandModelEvaluationResponse>(async (baseUrl) => {
    const response = await axios.get(`${baseUrl}/models/demand/evaluate`, { params });
    return response.data;
  });
};

export const evaluateDemandModelFast = async (params: { product: string; lookback_days?: number; test_days?: number }): Promise<DemandModelEvaluationFastResponse> => {
  return withApiFallback<DemandModelEvaluationFastResponse>(async (baseUrl) => {
    const response = await axios.get(`${baseUrl}/models/demand/evaluate_fast`, { params });
    return response.data;
  });
};

export const getDemandModelsStatus = async (): Promise<DemandModelsStatusResponse> => {
  return withApiFallback<DemandModelsStatusResponse>(async (baseUrl) => {
    const response = await axios.get(`${baseUrl}/models/demand/status`);
    return response.data;
  });
};

export const getImpactModelStatus = async (): Promise<ImpactModelStatusResponse> => {
  return withApiFallback<ImpactModelStatusResponse>(async (baseUrl) => {
    const response = await axios.get(`${baseUrl}/models/impact/status`);
    return response.data;
  });
};

export const predictImpact = async (body: { distance_km: number; scenario: string; base_duration_min?: number }): Promise<ImpactPredictResponse> => {
  return withApiFallback<ImpactPredictResponse>(async (baseUrl) => {
    const response = await axios.post(`${baseUrl}/models/impact/predict`, body);
    return response.data;
  });
};

export const trainImpactModelMock = async (body?: { n_samples?: number; n_estimators?: number; max_depth?: number }): Promise<ImpactTrainMockResponse> => {
  return withApiFallback<ImpactTrainMockResponse>(async (baseUrl) => {
    const response = await axios.post(`${baseUrl}/models/impact/train_mock`, body || {});
    return response.data;
  });
};

export const evaluateImpactModel = async (params?: { n_samples?: number; sample_points?: number }): Promise<ImpactEvaluateResponse> => {
  return withApiFallback<ImpactEvaluateResponse>(async (baseUrl) => {
    const response = await axios.get(`${baseUrl}/models/impact/evaluate`, { params });
    return response.data;
  });
};
