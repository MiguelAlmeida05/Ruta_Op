export interface ValidationStatsResponse {
  routing: {
    samples?: number;
    matches?: number;
    dijkstra_avg_time_ms?: number;
    astar_avg_time_ms?: number;
    speedup_factor?: number;
    cost_discrepancy_avg?: number;
    dijkstra_times_ms?: number[];
    astar_times_ms?: number[];
    cost_diffs?: number[];
    per_event?: Record<string, unknown>;
    error?: string;
  };
  simulation: {
    n_simulations?: number;
    mean_duration?: number;
    std_dev?: number;
    ci_95_lower?: number;
    ci_95_upper?: number;
    cv_percent?: number;
    mean_punctuality?: number;
    durations_sample?: number[];
    punctuality_sample?: number[];
    error?: string;
  };
  timestamp: number;
}

export interface EtaModelEvaluationResponse {
  model_loaded: boolean;
  n_samples: number;
  metrics: { mae: number; rmse: number; r2: number };
  classification?: {
    label_definition: string;
    score_definition: string;
    threshold_ratio: number;
    confusion_matrix: { tn: number; fp: number; fn: number; tp: number };
    precision: number;
    recall: number;
    f1: number;
    roc_auc: number;
    roc_curve: Array<{ fpr: number; tpr: number }>;
  };
  sample_points: Array<{ y_true: number; y_pred: number }>;
  feature_importances?: Array<{ feature: string; importance: number }>;
  latency_ms_single?: number | null;
  model_params?: Record<string, unknown> | null;
  timestamp: number;
}

export interface EtaModelStatusResponse {
  model_loaded: boolean;
  model_path: string;
  timestamp: number;
}

export interface EtaModelPredictResponse {
  predicted_duration_min: number;
  timestamp: number;
}

export interface EtaModelTrainMockResponse {
  trained: boolean;
  n_samples: number;
  params: { n_estimators: number; max_depth: number };
  metrics: { mae: number; rmse: number; r2: number; train?: { mae: number; rmse: number; r2: number }; test?: { mae: number; rmse: number; r2: number }; best_iteration?: number };
  train_time_s: number;
  model_loaded: boolean;
  timestamp: number;
}

export interface DemandModelEvaluationResponse {
  model_loaded: boolean;
  product: string;
  cv?: { initial: string; period: string; horizon: string };
  metrics: Record<string, number>;
  sample_points: Array<{
    date: string;
    y: number | null;
    yhat: number | null;
    yhat_lower: number | null;
    yhat_upper: number | null;
  }>;
  timestamp: number;
}

export interface DemandModelEvaluationFastResponse {
  model_loaded: boolean;
  product: string;
  data_source: string;
  window: { lookback_days: number; test_days: number };
  metrics: { mae: number; rmse: number; mape_pct: number; smape_pct?: number; wmape_pct?: number; r2?: number };
  sample_points: Array<{ date: string; y: number; yhat: number }>;
  timestamp: number;
}

export interface DemandModelsStatusResponse {
  models: Array<{
    product: string;
    model_path: string;
    model_file_present: boolean;
    last_modified: number | null;
  }>;
  timestamp: number;
}

export interface ImpactModelStatusResponse {
  model_loaded: boolean;
  model_path: string;
  timestamp: number;
}

export interface ImpactPrediction {
  duration_min: number;
  emissions_kg_co2: number;
  efficiency_score: number;
  freshness_score: number;
  punctuality_score: number;
  satisfaction_score: number;
  waste_percent: number;
  energy_saving_percent: number;
}

export interface ImpactPredictResponse {
  prediction: ImpactPrediction;
  timestamp: number;
}

export interface ImpactTrainMockResponse {
  trained: boolean;
  n_samples: number;
  params: { n_estimators: number; max_depth: number };
  metrics_train: Record<string, { mae: number; rmse: number; r2: number }>;
  metrics_test: Record<string, { mae: number; rmse: number; r2: number }>;
  train_time_s: number;
  model_loaded: boolean;
  timestamp: number;
}

export interface ImpactEvaluateResponse {
  model_loaded: boolean;
  n_samples: number;
  metrics_by_target_train: Record<string, { mae: number; rmse: number; r2: number }>;
  metrics_by_target_test: Record<string, { mae: number; rmse: number; r2: number }>;
  scenario_metrics_test: Record<string, Record<string, { mae: number; rmse: number; r2: number }>>;
  cv_r2: Record<string, { r2_mean: number; r2_std: number }>;
  classifications: Record<
    string,
    {
      confusion_matrix: { tn: number; fp: number; fn: number; tp: number };
      precision: number;
      recall: number;
      f1: number;
      roc_auc: number;
      roc_curve: Array<{ fpr: number; tpr: number }>;
    }
  >;
  sample_points: Array<{ y_true: number; y_pred: number }>;
  timestamp: number;
}
