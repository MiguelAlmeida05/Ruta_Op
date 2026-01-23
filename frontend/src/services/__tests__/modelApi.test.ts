import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { evaluateEtaModel, getEtaModelStatus, predictEta, trainEtaModelMock } from '../api';

vi.mock('axios', () => {
  const mock = {
    get: vi.fn(),
    post: vi.fn(),
    isAxiosError: () => false
  };
  return { default: mock };
});

const axiosMock = axios as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  isAxiosError: (e: unknown) => boolean;
};

describe('Model API', () => {
  beforeEach(() => {
    axiosMock.get.mockReset();
    axiosMock.post.mockReset();
  });

  it('calls ETA evaluate endpoint', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: {
        model_loaded: true,
        n_samples: 200,
        metrics: { mae: 1, rmse: 2, r2: 0.9 },
        sample_points: [],
        timestamp: 1
      }
    });

    const res = await evaluateEtaModel({ n_samples: 200, sample_points: 50 });
    expect(res.model_loaded).toBe(true);
    expect(axiosMock.get).toHaveBeenCalledTimes(1);
    expect(axiosMock.get).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/models/eta/evaluate',
      { params: { n_samples: 200, sample_points: 50 } }
    );
  });

  it('calls ETA status endpoint', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: {
        model_loaded: true,
        model_path: 'x',
        timestamp: 1
      }
    });

    const res = await getEtaModelStatus();
    expect(res.model_loaded).toBe(true);
    expect(axiosMock.get).toHaveBeenCalledWith('http://127.0.0.1:8000/api/models/eta/status');
  });

  it('calls ETA predict endpoint', async () => {
    axiosMock.post.mockResolvedValueOnce({
      data: { predicted_duration_min: 12.34, timestamp: 1 }
    });

    const res = await predictEta({
      base_duration_min: 10,
      distance_km: 5,
      weather_data: { rain_mm: 0 },
      traffic_data: { level: 0.2 }
    });

    expect(res.predicted_duration_min).toBeCloseTo(12.34, 2);
    expect(axiosMock.post).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/models/eta/predict',
      {
        base_duration_min: 10,
        distance_km: 5,
        weather_data: { rain_mm: 0 },
        traffic_data: { level: 0.2 }
      }
    );
  });

  it('calls ETA train mock endpoint', async () => {
    axiosMock.post.mockResolvedValueOnce({
      data: {
        trained: true,
        n_samples: 1000,
        params: { n_estimators: 20, max_depth: 3 },
        metrics: { mae: 1, rmse: 2, r2: 0.9 },
        train_time_s: 0.1,
        model_loaded: true,
        timestamp: 1
      }
    });

    const res = await trainEtaModelMock({ n_samples: 1000, n_estimators: 20, max_depth: 3 });
    expect(res.trained).toBe(true);
    expect(axiosMock.post).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/models/eta/train_mock',
      { n_samples: 1000, n_estimators: 20, max_depth: 3 }
    );
  });
});
