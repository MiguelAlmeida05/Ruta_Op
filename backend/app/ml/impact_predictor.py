import os
import math
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.multioutput import MultiOutputRegressor
from sklearn.metrics import confusion_matrix, roc_curve, auc, precision_recall_fscore_support
from xgboost import XGBRegressor

from app.core.logger import get_logger

logger = get_logger(__name__)


SCENARIOS: Dict[str, Dict[str, float]] = {
    "Normal": {"Ft": 1.0, "Fr": 1.0, "Fc": 1.0},
    "Lluvia": {"Ft": 1.3, "Fr": 1.5, "Fc": 1.1},
    "Tráfico": {"Ft": 1.8, "Fr": 1.2, "Fc": 1.4},
    "Huelga": {"Ft": 2.5, "Fr": 3.0, "Fc": 1.2},
}

MODEL_VERSION = "impact_xgboost_v2"


def _deadline_minutes(distance_km: float) -> float:
    if distance_km <= 3.0:
        return 7.0
    if distance_km <= 9.0:
        return 15.0
    if distance_km <= 15.0:
        return 26.0
    if distance_km <= 29.0:
        return 38.0
    return 38.0 + (distance_km - 29.0) * 0.8


def _normal_cdf(x: float, mu: float, sigma: float) -> float:
    if sigma <= 0:
        return 0.0 if x < mu else 1.0
    z = (x - mu) / (sigma * math.sqrt(2))
    return 0.5 * (1.0 + math.erf(z))


def _clamp(x: float, lo: float, hi: float) -> float:
    return float(max(lo, min(hi, x)))


def _generate_impact_synthetic(
    n_samples: int,
    rng: np.random.Generator,
) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray, np.ndarray]:
    distance_km = rng.uniform(0.8, 35.0, n_samples)
    scenario_code = rng.choice([0, 1, 2, 3], size=n_samples, p=[0.60, 0.15, 0.20, 0.05])
    scenario_names = np.array(["Normal", "Lluvia", "Tráfico", "Huelga"])[scenario_code]

    Ft = np.array([SCENARIOS[s]["Ft"] for s in scenario_names], dtype=float)
    Fr = np.array([SCENARIOS[s]["Fr"] for s in scenario_names], dtype=float)
    Fc = np.array([SCENARIOS[s]["Fc"] for s in scenario_names], dtype=float)

    speed_base = np.clip(rng.normal(34.0, 6.5, n_samples), 18.0, 58.0)
    base_duration_min = (distance_km / np.maximum(speed_base, 1e-6)) * 60.0
    base_duration_min = base_duration_min * np.clip(rng.normal(1.0, 0.04, n_samples), 0.9, 1.1)

    micro_congestion = np.clip(rng.normal(1.0, 0.14, n_samples), 0.6, 1.6)
    route_penalty_min = np.clip(
        rng.normal(1.2, 1.4, n_samples) + (distance_km / 35.0) * rng.uniform(0.0, 5.0, n_samples),
        0.0,
        12.0,
    )

    stop_mu = np.where(scenario_code == 0, 1.4, np.where(scenario_code == 1, 2.1, np.where(scenario_code == 2, 3.5, 4.2)))
    stop_time_min = rng.lognormal(mean=np.log(stop_mu), sigma=0.55, size=n_samples)
    stop_time_min = np.clip(stop_time_min, 0.0, 18.0)

    dispatch_delay_min = np.clip(rng.normal(0.5, 0.8, n_samples), 0.0, 6.0)
    roadworks = rng.binomial(1, p=np.clip(0.06 + 0.08 * (scenario_code == 2).astype(float), 0.0, 0.25), size=n_samples)
    roadworks_delay = roadworks * rng.uniform(0.0, 8.0, n_samples)

    real_duration_min = (base_duration_min * Ft * micro_congestion) + stop_time_min + route_penalty_min + dispatch_delay_min + roadworks_delay
    real_duration_min = real_duration_min * np.clip(rng.normal(1.0, 0.085, n_samples), 0.75, 1.35)
    real_duration_min = np.clip(real_duration_min, 1.0, 240.0)

    vehicle_efficiency = np.clip(rng.normal(1.0, 0.10, n_samples), 0.75, 1.30)
    vehicle_efficiency = np.clip(rng.normal(1.0, 0.14, n_samples), 0.70, 1.35)
    emissions_kg_co2 = ((distance_km * 0.11 * Fc) + (stop_time_min * 0.03 * Fc)) * vehicle_efficiency + rng.normal(0.0, 0.09, n_samples)
    emissions_kg_co2 = np.clip(emissions_kg_co2, 0.0, None)

    base_eff = 92.0 - (0.22 * distance_km) - (18.0 * (Ft - 1.0)) - (14.0 * (Fc - 1.0)) - (0.35 * stop_time_min)
    driver_style = np.clip(rng.normal(0.0, 1.0, n_samples), -2.5, 2.5)
    efficiency_score = base_eff + (driver_style * 3.0) + rng.normal(0.0, 2.4, n_samples)
    efficiency_score = np.clip(efficiency_score, 0.0, 100.0)

    packaging_quality = np.clip(rng.normal(0.0, 1.0, n_samples), -2.0, 2.0)
    t_total_hr = real_duration_min / 60.0
    alpha = 2.2
    beta = 0.55
    freshness_score = 100.0 - (alpha * t_total_hr) - (beta * Fr * distance_km) + (packaging_quality * 2.0) + rng.normal(0.0, 2.0, n_samples)
    freshness_score = np.clip(freshness_score, 0.0, 100.0)

    deadlines = np.array([_deadline_minutes(float(d)) for d in distance_km], dtype=float)
    late = np.maximum(0.0, real_duration_min - deadlines)
    early = np.maximum(0.0, deadlines - real_duration_min)
    punctuality_score = 98.0 - (2.2 * late) + (0.18 * early)
    punctuality_score = np.clip(punctuality_score + rng.normal(0.0, 0.6, n_samples), 0.0, 100.0)

    satisfaction_score = (0.58 * (punctuality_score / 20.0)) + (0.42 * (freshness_score / 20.0)) + rng.normal(0.0, 0.12, n_samples)
    satisfaction_score = np.clip(satisfaction_score, 1.0, 5.0)

    base_waste = (100.0 - freshness_score)
    accident_prob = np.clip(0.03 * Fr + 0.02 * (stop_time_min / 10.0), 0.0, 0.35)
    accident = rng.binomial(1, accident_prob, n_samples) * rng.uniform(0.0, 6.0, n_samples)
    waste_percent = np.clip(base_waste + accident + rng.normal(0.0, 0.8, n_samples), 0.0, 100.0)

    eco_factor = np.clip(rng.normal(1.0, 0.04, n_samples), 0.90, 1.15)
    baseline_factor = np.clip(rng.normal(1.0, 0.03, n_samples), 0.92, 1.12)
    consumption_actual = (distance_km * 0.08 * Fc + stop_time_min * 0.004 * Fc) * eco_factor
    consumption_old = (distance_km * 0.12 + stop_time_min * 0.005) * baseline_factor
    energy_saving_percent = 100.0 * (1.0 - (consumption_actual / np.maximum(consumption_old, 1e-6)))
    energy_saving_percent = np.clip(energy_saving_percent + rng.normal(0.0, 1.6, n_samples), 0.0, 100.0)

    X = pd.DataFrame(
        {
            "distance_km": distance_km,
            "scenario_code": scenario_code.astype(float),
            "base_duration_min": base_duration_min,
            "risk_factor": Fr,
            "consumption_factor": Fc,
        }
    )

    y = np.vstack(
        [
            real_duration_min,
            emissions_kg_co2,
            efficiency_score,
            freshness_score,
            punctuality_score,
            satisfaction_score,
            waste_percent,
            energy_saving_percent,
        ]
    ).T

    return X, y, scenario_code, scenario_names


@dataclass
class ImpactPrediction:
    duration_min: float
    emissions_kg_co2: float
    efficiency_score: float
    freshness_score: float
    punctuality_score: float
    satisfaction_score: float
    waste_percent: float
    energy_saving_percent: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "duration_min": float(self.duration_min),
            "emissions_kg_co2": float(self.emissions_kg_co2),
            "efficiency_score": float(self.efficiency_score),
            "freshness_score": float(self.freshness_score),
            "punctuality_score": float(self.punctuality_score),
            "satisfaction_score": float(self.satisfaction_score),
            "waste_percent": float(self.waste_percent),
            "energy_saving_percent": float(self.energy_saving_percent),
        }


class ImpactPredictor:
    def __init__(self, model_path: Optional[str] = None):
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), "models", "impact_xgboost_v1.pkl")
        self.model_path = model_path
        self.model_loaded = False
        self.model: Optional[MultiOutputRegressor] = None
        self.feature_columns = ["distance_km", "scenario_code", "base_duration_min", "risk_factor", "consumption_factor"]
        self.target_names = [
            "duration_min",
            "emissions_kg_co2",
            "efficiency_score",
            "freshness_score",
            "punctuality_score",
            "satisfaction_score",
            "waste_percent",
            "energy_saving_percent",
        ]
        self.model_version = MODEL_VERSION
        self._load()

    def _load(self):
        try:
            if os.path.exists(self.model_path):
                payload = joblib.load(self.model_path)
                if payload.get("version") != MODEL_VERSION:
                    self.model_loaded = False
                    self.model = None
                    logger.warning("Impact model version mismatch. Needs retraining.")
                    return
                self.model = payload.get("model")
                self.feature_columns = payload.get("feature_columns", self.feature_columns)
                self.target_names = payload.get("target_names", self.target_names)
                self.model_loaded = bool(self.model is not None)
                if self.model_loaded:
                    logger.info(f"Modelo Impact cargado desde {self.model_path}")
            else:
                self.model_loaded = False
        except Exception as e:
            logger.warning(f"No se pudo cargar modelo Impact: {e}")
            self.model_loaded = False

    def force_reload(self):
        self._load()

    def _scenario_to_code(self, scenario: str) -> int:
        mapping = {"Normal": 0, "Lluvia": 1, "Tráfico": 2, "Huelga": 3}
        return int(mapping.get(scenario, 0))

    def _scenario_factors(self, scenario: str) -> Tuple[float, float, float]:
        f = SCENARIOS.get(scenario, SCENARIOS["Normal"])
        return float(f["Ft"]), float(f["Fr"]), float(f["Fc"])

    def predict(
        self,
        distance_km: float,
        scenario: str,
        base_duration_min: Optional[float] = None,
    ) -> Optional[ImpactPrediction]:
        if not self.model_loaded or self.model is None:
            return None

        distance_km = float(max(0.0, distance_km))
        Ft, Fr, Fc = self._scenario_factors(scenario)
        scenario_code = self._scenario_to_code(scenario)

        if base_duration_min is None:
            ideal_speed_kmh = 35.0
            base_duration_min = (distance_km / max(ideal_speed_kmh, 1e-6)) * 60.0

        X = pd.DataFrame(
            [
                {
                    "distance_km": distance_km,
                    "scenario_code": scenario_code,
                    "base_duration_min": float(base_duration_min),
                    "risk_factor": Fr,
                    "consumption_factor": Fc,
                }
            ]
        )[self.feature_columns]

        y = self.model.predict(X)[0]
        pred = {name: float(val) for name, val in zip(self.target_names, y)}

        pred["duration_min"] = max(0.0, pred["duration_min"])
        pred["emissions_kg_co2"] = max(0.0, pred["emissions_kg_co2"])
        pred["efficiency_score"] = _clamp(pred["efficiency_score"], 0.0, 100.0)
        pred["freshness_score"] = _clamp(pred["freshness_score"], 0.0, 100.0)
        pred["punctuality_score"] = _clamp(pred["punctuality_score"], 0.0, 100.0)
        pred["satisfaction_score"] = _clamp(pred["satisfaction_score"], 1.0, 5.0)
        pred["waste_percent"] = _clamp(pred["waste_percent"], 0.0, 100.0)
        pred["energy_saving_percent"] = _clamp(pred["energy_saving_percent"], 0.0, 100.0)

        return ImpactPrediction(**pred)

    def train_mock(self, n_samples: int = 10000, n_estimators: int = 120, max_depth: int = 5) -> Dict[str, Any]:
        n_samples = int(max(2000, min(n_samples, 200000)))
        n_estimators = int(max(50, min(n_estimators, 800)))
        max_depth = int(max(2, min(max_depth, 12)))

        rng = np.random.default_rng(42)
        X_raw, y, scenario_code, _ = _generate_impact_synthetic(n_samples=n_samples, rng=rng)
        X = X_raw[self.feature_columns]

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=scenario_code
        )

        base_model = XGBRegressor(
            n_estimators=n_estimators,
            learning_rate=0.06,
            max_depth=max_depth,
            subsample=0.75,
            colsample_bytree=0.75,
            reg_lambda=2.0,
            reg_alpha=0.2,
            min_child_weight=4.0,
            gamma=0.3,
            objective="reg:squarederror",
            n_jobs=-1,
            tree_method="hist",
        )
        model = MultiOutputRegressor(base_model)

        start = time.time()
        model.fit(X_train, y_train)
        train_time_s = time.time() - start

        y_pred_train = model.predict(X_train)
        y_pred_test = model.predict(X_test)
        metrics_train: Dict[str, Dict[str, float]] = {}
        metrics_test: Dict[str, Dict[str, float]] = {}
        for idx, name in enumerate(self.target_names):
            metrics_train[name] = {
                "mae": float(mean_absolute_error(y_train[:, idx], y_pred_train[:, idx])),
                "rmse": float(np.sqrt(mean_squared_error(y_train[:, idx], y_pred_train[:, idx]))),
                "r2": float(r2_score(y_train[:, idx], y_pred_train[:, idx])),
            }
            metrics_test[name] = {
                "mae": float(mean_absolute_error(y_test[:, idx], y_pred_test[:, idx])),
                "rmse": float(np.sqrt(mean_squared_error(y_test[:, idx], y_pred_test[:, idx]))),
                "r2": float(r2_score(y_test[:, idx], y_pred_test[:, idx])),
            }

        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(
            {"model": model, "feature_columns": self.feature_columns, "target_names": self.target_names, "version": MODEL_VERSION},
            self.model_path,
        )
        self.model = model
        self.model_loaded = True

        return {
            "trained": True,
            "n_samples": n_samples,
            "params": {"n_estimators": n_estimators, "max_depth": max_depth},
            "metrics_train": metrics_train,
            "metrics_test": metrics_test,
            "train_time_s": float(round(train_time_s, 4)),
        }

    def evaluate_mock(self, n_samples: int = 6000, sample_points: int = 300) -> Dict[str, Any]:
        if not self.model_loaded or self.model is None:
            raise RuntimeError("Impact model not loaded")

        n_samples = int(max(1000, min(n_samples, 50000)))
        sample_points = int(max(80, min(sample_points, 1000)))

        rng = np.random.default_rng(123)
        X_raw, y_true, scenario_code, scenario_names = _generate_impact_synthetic(n_samples=n_samples, rng=rng)
        X = X_raw[self.feature_columns]

        X_train, X_test, y_train, y_test, scen_train, scen_test = train_test_split(
            X,
            y_true,
            scenario_names,
            test_size=0.25,
            random_state=123,
            stratify=scenario_code,
        )

        y_pred_train = self.model.predict(X_train)
        y_pred_test = self.model.predict(X_test)

        def metric_pack(yt: np.ndarray, yp: np.ndarray) -> Dict[str, Dict[str, float]]:
            out: Dict[str, Dict[str, float]] = {}
            for j, name in enumerate(self.target_names):
                out[name] = {
                    "mae": float(mean_absolute_error(yt[:, j], yp[:, j])),
                    "rmse": float(np.sqrt(mean_squared_error(yt[:, j], yp[:, j]))),
                    "r2": float(r2_score(yt[:, j], yp[:, j])),
                }
            return out

        metrics_train = metric_pack(y_train, y_pred_train)
        metrics_test = metric_pack(y_test, y_pred_test)

        scenario_metrics: Dict[str, Dict[str, Dict[str, float]]] = {}
        for s in ["Normal", "Lluvia", "Tráfico", "Huelga"]:
            mask = scen_test == s
            if not np.any(mask):
                continue
            scenario_metrics[s] = metric_pack(y_test[mask], y_pred_test[mask])

        cv = StratifiedKFold(n_splits=4, shuffle=True, random_state=7)
        cv_r2: Dict[str, Dict[str, float]] = {}
        for j, name in enumerate(self.target_names):
            scores = []
            for tr, te in cv.split(X, scenario_code):
                yp = self.model.predict(X.iloc[te])[:, j]
                scores.append(float(r2_score(y_true[te, j], yp)))
            cv_r2[name] = {"r2_mean": float(np.mean(scores)), "r2_std": float(np.std(scores))}

        def build_binary_metrics(yt: np.ndarray, yp: np.ndarray) -> Dict[str, Dict[str, Any]]:
            defs = {
                "on_time": {"label": yt[:, self.target_names.index("punctuality_score")] >= 90.0, "score": np.clip(yp[:, self.target_names.index("punctuality_score")] / 100.0, 0, 1)},
                "fresh_high": {"label": yt[:, self.target_names.index("freshness_score")] >= 90.0, "score": np.clip(yp[:, self.target_names.index("freshness_score")] / 100.0, 0, 1)},
                "efficiency_high": {"label": yt[:, self.target_names.index("efficiency_score")] >= 80.0, "score": np.clip(yp[:, self.target_names.index("efficiency_score")] / 100.0, 0, 1)},
                "waste_low": {"label": yt[:, self.target_names.index("waste_percent")] <= 10.0, "score": np.clip(1.0 - (yp[:, self.target_names.index("waste_percent")] / 100.0), 0, 1)},
            }

            out: Dict[str, Dict[str, Any]] = {}
            for key, d in defs.items():
                y_true_cls = d["label"].astype(int)
                y_score = d["score"].astype(float)
                y_pred_cls = (y_score >= 0.5).astype(int)

                tn, fp, fn, tp = confusion_matrix(y_true_cls, y_pred_cls, labels=[0, 1]).ravel()
                precision, recall, f1, _ = precision_recall_fscore_support(y_true_cls, y_pred_cls, average="binary", zero_division=0)
                fpr, tpr, _ = roc_curve(y_true_cls, y_score)
                roc_auc = float(auc(fpr, tpr))
                out[key] = {
                    "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
                    "precision": float(precision),
                    "recall": float(recall),
                    "f1": float(f1),
                    "roc_auc": float(roc_auc),
                    "roc_curve": [{"fpr": float(a), "tpr": float(b)} for a, b in zip(fpr, tpr)],
                }
            return out

        classifications = build_binary_metrics(y_test, y_pred_test)

        idx = rng.choice(len(y_test), size=min(sample_points, len(y_test)), replace=False)
        sample = [{"y_true": float(y_test[i, 0]), "y_pred": float(y_pred_test[i, 0])} for i in idx]

        return {
            "model_loaded": True,
            "n_samples": n_samples,
            "metrics_by_target_train": metrics_train,
            "metrics_by_target_test": metrics_test,
            "scenario_metrics_test": scenario_metrics,
            "cv_r2": cv_r2,
            "classifications": classifications,
            "sample_points": sample,
        }

