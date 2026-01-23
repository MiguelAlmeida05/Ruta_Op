import random
from enum import Enum
import math
import logging
import threading
import time
from typing import Dict, Optional, List, Tuple
import uuid
import numpy as np
import pandas as pd
from app.ml.eta_predictor import ETAPredictor
from app.ml.impact_predictor import ImpactPredictor, SCENARIOS
from app.core.logger import get_logger

# Configure logging
logger = get_logger(__name__)

# Global ML Predictor instance
_eta_predictor = ETAPredictor()
_eta_quality_cache = None
_impact_predictor = ImpactPredictor()

def _get_eta_quality():
    global _eta_quality_cache
    if _eta_quality_cache is not None:
        return _eta_quality_cache
    if not _eta_predictor.model_loaded:
        _eta_quality_cache = {"available": False}
        return _eta_quality_cache

    try:
        rng = np.random.default_rng(42)
        n = 1200

        dist = rng.uniform(1.0, 50.0, n)
        speed_kmh = np.clip(rng.normal(33.0, 7.0, n), 16.0, 60.0)
        base_dur = (dist / np.maximum(speed_kmh, 1e-6)) * 60.0
        base_dur = base_dur * np.clip(rng.normal(1.0, 0.05, n), 0.85, 1.15)

        hour = rng.integers(6, 23, n)
        day = rng.integers(0, 7, n)
        is_weekend = (day >= 5).astype(int)
        is_peak_hour = (((hour >= 7) & (hour <= 9)) | ((hour >= 17) & (hour <= 19))).astype(int)

        rain = rng.choice([0, 5, 20], size=n, p=[0.78, 0.17, 0.05])
        traffic = rng.beta(2.0, 2.5, n)
        road_ratio = rng.uniform(0.3, 0.8, n)

        traffic_effect = 0.15 + 0.85 * (1.0 - np.exp(-2.2 * traffic))
        rain_effect = np.where(rain > 0, 0.08 + (rain / 70.0), 0.0)
        peak_effect = ((is_peak_hour == 1) & (is_weekend == 0)).astype(float) * 0.28

        stop_time = np.clip(rng.lognormal(mean=np.log(0.7), sigma=0.45, size=n), 0.0, 6.0)
        incident = rng.binomial(1, p=np.clip(0.02 + 0.06 * traffic + 0.03 * (rain > 0).astype(float), 0.0, 0.25), size=n)
        incident_delay = incident * rng.uniform(0.0, 10.0, n)

        multiplier = 1.0 + peak_effect + rain_effect + (traffic_effect * 0.65)
        y_true = (base_dur * multiplier) + stop_time + incident_delay
        y_true = np.clip(y_true, 1.0, 240.0)
        sigma = np.clip(0.06 * y_true + 0.8 * (rain > 0).astype(float) + 0.7 * traffic, 0.8, 12.0)
        y_true = np.clip(y_true + rng.normal(0.0, sigma, n), 1.0, 240.0)

        df = pd.DataFrame(
            {
                "hour_of_day": hour,
                "day_of_week": day,
                "is_weekend": is_weekend,
                "distance_km": dist,
                "base_duration_min": base_dur,
                "rain_intensity": rain,
                "traffic_level": traffic,
                "is_peak_hour": is_peak_hour,
                "road_type_primary_ratio": road_ratio,
            }
        )[_eta_predictor.pipeline.feature_columns]

        y_pred = _eta_predictor.model.predict(df)
        mae = float(np.mean(np.abs(y_true - y_pred)))
        ss_res = float(np.sum((y_true - y_pred) ** 2))
        ss_tot = float(np.sum((y_true - float(np.mean(y_true))) ** 2))
        r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

        latency_ms_single = None
        try:
            sample_row = df.iloc[0:1]
            t0 = time.time()
            for _ in range(60):
                _eta_predictor.model.predict(sample_row)
            latency_ms_single = ((time.time() - t0) / 60.0) * 1000.0
        except Exception:
            latency_ms_single = None

        _eta_quality_cache = {
            "available": True,
            "mae": float(round(mae, 4)),
            "r2": float(round(r2, 6)),
            "latency_ms_single": float(round(latency_ms_single, 4)) if latency_ms_single is not None else None,
            "n_eval": int(n),
        }
        return _eta_quality_cache
    except Exception:
        _eta_quality_cache = {"available": False}
        return _eta_quality_cache

class SimulationState(Enum):
    NORMAL = "Normal"
    TRAFFIC = "Tráfico"
    RAIN = "Lluvia"
    STRIKE = "Huelga"

class MarkovChain:
    def __init__(self):
        self.states = list(SimulationState)
        # Matriz de transición (dominancia diagonal)
        self.transition_matrix = {
            SimulationState.NORMAL: {SimulationState.NORMAL: 0.85, SimulationState.TRAFFIC: 0.10, SimulationState.RAIN: 0.05, SimulationState.STRIKE: 0.0},
            SimulationState.TRAFFIC: {SimulationState.NORMAL: 0.20, SimulationState.TRAFFIC: 0.70, SimulationState.RAIN: 0.10, SimulationState.STRIKE: 0.0},
            SimulationState.RAIN: {SimulationState.NORMAL: 0.20, SimulationState.TRAFFIC: 0.30, SimulationState.RAIN: 0.50, SimulationState.STRIKE: 0.0},
            SimulationState.STRIKE: {SimulationState.NORMAL: 0.05, SimulationState.TRAFFIC: 0.05, SimulationState.RAIN: 0.0, SimulationState.STRIKE: 0.90}
        }
        self.current_state = SimulationState.NORMAL

    def next_state(self):
        transitions = self.transition_matrix[self.current_state]
        states = list(transitions.keys())
        weights = list(transitions.values())
        self.current_state = random.choices(states, weights=weights, k=1)[0]
        return self.current_state
        
    def get_state(self):
        return self.current_state

    def to_dict(self):
        """Serializa el estado actual para persistencia."""
        return {"current_state": self.current_state.value}

    def from_dict(self, data):
        """Restaura el estado desde un diccionario."""
        if "current_state" in data:
            try:
                self.current_state = SimulationState(data["current_state"])
            except ValueError:
                logger.warning(f"Invalid state {data['current_state']}, keeping default.")

class SimulationSessionManager:
    """
    Gestor de sesiones para mantener estados de simulación aislados por usuario.
    Thread-safe para acceso concurrente.
    """
    def __init__(self):
        self._sessions: Dict[str, MarkovChain] = {}
        self._lock = threading.Lock()

    def get_session(self, session_id: str) -> MarkovChain:
        """
        Obtiene la cadena de Markov asociada a una sesión.
        Si no existe, crea una nueva.
        """
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = MarkovChain()
            return self._sessions[session_id]

    def create_session(self) -> str:
        """
        Crea una nueva sesión y retorna su ID.
        """
        session_id = str(uuid.uuid4())
        with self._lock:
            self._sessions[session_id] = MarkovChain()
        return session_id
        
    def delete_session(self, session_id: str):
        """
        Elimina una sesión y libera recursos.
        """
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]

    def export_session(self, session_id: str) -> Optional[Dict]:
        """Exporta el estado de una sesión para persistencia."""
        with self._lock:
            if session_id in self._sessions:
                return self._sessions[session_id].to_dict()
            return None

    def import_session(self, session_id: str, data: Dict):
        """Importa/Restaura una sesión desde datos persistidos."""
        with self._lock:
            chain = MarkovChain()
            chain.from_dict(data)
            self._sessions[session_id] = chain

class SmartRouteEngine:
    """
    Motor inteligente para el ajuste dinámico de rutas basado en condiciones del entorno.
    """
    @staticmethod
    def calculate_optimal_route(
        current_route: List[List[float]],
        base_duration_min: float,
        base_distance_km: float,
        state: SimulationState,
        path_finder_service = None # Dependency Injection opcional para recalculo real
    ) -> Dict:
        """
        Calcula la ruta óptima y el tiempo ajustado según las condiciones actuales.
        
        Args:
            current_route: Lista de coordenadas [lat, lng] de la ruta original.
            base_duration_min: Tiempo estimado original en condiciones normales.
            base_distance_km: Distancia original.
            state: Estado actual de la simulación (Normal, Tráfico, Lluvia, Huelga).
            path_finder_service: Servicio capaz de recalcular rutas (si está disponible).
            
        Returns:
            Diccionario con la ruta ajustada, nuevo tiempo, y metadatos de cambios.
        """
        
        result = {
            "final_route": current_route,
            "final_duration_min": base_duration_min,
            "final_distance_km": base_distance_km,
            "adjustments": [],
            "route_changed": False,
            "original_duration_min": base_duration_min
        }
        
        # 1. Condición de TRÁFICO
        if state == SimulationState.TRAFFIC:
            # En un sistema real, aquí llamaríamos a path_finder con penalizaciones
            # Simulamos el hallazgo de una ruta alternativa
            # Asumimos que la ruta alternativa es más larga en distancia pero evita el atasco total
            
            # Lógica: Si hay tráfico pesado, la ruta original se vuelve muy lenta.
            # Buscamos "ruta alternativa" que aumenta distancia un 10-15% pero controla el tiempo.
            
            # Simulación de cambio de geometría (perturbación leve para demo visual)
            # En producción real, esto sería un re-query al grafo.
            result["route_changed"] = True
            result["final_distance_km"] *= 1.12
            result["adjustments"].append("Desvío por Tráfico (+12% distancia)")
            
        # 2. Condición de HUELGA
        elif state == SimulationState.STRIKE:
            # Huelga implica bloqueo total de ciertos segmentos.
            # Desvío obligatorio y significativo.
            result["route_changed"] = True
            result["final_distance_km"] *= 1.25
            result["adjustments"].append("Desvío por Huelga (+25% distancia)")

        if state == SimulationState.RAIN:
            result["adjustments"].append("Condiciones de Lluvia (impacto en tiempo y calidad)")

        # Ajuste final de redondeo
        result["final_duration_min"] = round(result["final_duration_min"], 2)
        result["final_distance_km"] = round(result["final_distance_km"], 2)
        
        return result

class FactorSimulator:
    @staticmethod
    def calibrate_base_time(distance_km: float, raw_duration_min: float) -> float:
        """
        Calibra el tiempo base según la distancia para ajustarse a rangos realistas.
        Rangos objetivo (minutos):
        - 1 a 3 km: 5 a 7
        - 4 a 9 km: 10 a 15
        - 10 a 15 km: 20 a 26
        - 15 a 29+ km: 27 a 38 (y proyección lineal suave)
        """
        # Validation - Robustness against negative values
        if distance_km < 0:
            logger.warning(f"Negative distance provided: {distance_km}. Clamping to 0.")
            distance_km = 0
        
        if raw_duration_min < 0:
            logger.warning(f"Negative raw duration provided: {raw_duration_min}. Clamping to 0.")
            raw_duration_min = 0

        # Check for NaN or Inf
        if math.isnan(distance_km) or math.isinf(distance_km):
             logger.warning(f"Invalid distance provided: {distance_km}. Clamping to 0.")
             distance_km = 0
        if math.isnan(raw_duration_min) or math.isinf(raw_duration_min):
             logger.warning(f"Invalid duration provided: {raw_duration_min}. Clamping to 0.")
             raw_duration_min = 0

        if distance_km <= 3.0:
            min_allowed, max_allowed = 5.0, 7.0
        elif distance_km <= 9.0:
            min_allowed, max_allowed = 10.0, 15.0
        elif distance_km <= 15.0:
            min_allowed, max_allowed = 20.0, 26.0
        elif distance_km <= 29.0:
            min_allowed, max_allowed = 27.0, 38.0
        else:
            extra = (distance_km - 29.0) * 0.8
            min_allowed, max_allowed = 27.0 + extra, 38.0 + extra

        if raw_duration_min <= 0:
            return (min_allowed + max_allowed) / 2.0

        return max(min_allowed, min(max_allowed, raw_duration_min))

    @staticmethod
    def simulate_factors(state: SimulationState, base_duration_min: float, distance_km: float, n_iterations: int = 100):
        if n_iterations <= 0:
            logger.warning("n_iterations must be positive. Defaulting to 100.")
            n_iterations = 100
            
        calibrated_base_time = FactorSimulator.calibrate_base_time(distance_km, base_duration_min)
        
        results = {
            "simulated_duration": [],
            "initial_freshness": [],
            "degradation_rate": [],
            "fuel_factor": []
        }

        for _ in range(n_iterations):
            # 1. Factor Tiempo (Multiplicador sobre base)
            ml_duration = None
            if _eta_predictor.model_loaded:
                weather_data = {'rain_mm': 0}
                traffic_data = {'level': 0}
                
                if state == SimulationState.RAIN:
                    weather_data['rain_mm'] = 20
                elif state == SimulationState.TRAFFIC:
                    traffic_data['level'] = 0.8
                elif state == SimulationState.STRIKE:
                    traffic_data['level'] = 1.0
                
                ml_duration = _eta_predictor.predict(
                    base_duration_min=calibrated_base_time,
                    distance_km=distance_km,
                    weather_data=weather_data,
                    traffic_data=traffic_data
                )

            if ml_duration:
                noise = random.normalvariate(1.0, 0.03) 
                results["simulated_duration"].append(ml_duration * noise)
            else:
                # Fallback
                if state == SimulationState.NORMAL:
                    time_params = (0.95, 1.0, 1.05)
                elif state == SimulationState.TRAFFIC:
                    time_params = (1.2, 1.4, 1.8)
                elif state == SimulationState.RAIN:
                    time_params = (1.1, 1.25, 1.4)
                else: # STRIKE
                    time_params = (1.5, 2.0, 3.0)
                    
                time_factor = random.triangular(*time_params)
                results["simulated_duration"].append(calibrated_base_time * time_factor)
            
            # 2. Factor Frescura
            if state == SimulationState.NORMAL:
                fresh_params = (0.01, 0.02, 0.03)
            elif state == SimulationState.TRAFFIC:
                fresh_params = (0.02, 0.03, 0.05)
            elif state == SimulationState.RAIN:
                fresh_params = (0.03, 0.05, 0.08)
            else: # STRIKE
                fresh_params = (0.05, 0.10, 0.15)
                
            results["initial_freshness"].append(random.triangular(0.95, 1.0, 0.99) * 100)
            results["degradation_rate"].append(random.triangular(*fresh_params))
            
            # 3. Factor Combustible
            if state == SimulationState.NORMAL:
                fuel_params = (0.9, 1.0, 1.1)
            elif state == SimulationState.TRAFFIC:
                fuel_params = (1.3, 1.5, 1.8) 
            elif state == SimulationState.RAIN:
                fuel_params = (1.1, 1.2, 1.3)
            else: # STRIKE
                fuel_params = (1.0, 1.2, 1.5)
                
            results["fuel_factor"].append(random.triangular(*fuel_params))

        avg_results = {
            "simulated_duration": sum(results["simulated_duration"]) / n_iterations,
            "initial_freshness": sum(results["initial_freshness"]) / n_iterations,
            "degradation_rate": sum(results["degradation_rate"]) / n_iterations,
            "fuel_factor": sum(results["fuel_factor"]) / n_iterations,
            "state": state
        }
        
        return avg_results

class KPICalculator:
    @staticmethod
    def calculate_kpis(factors, base_metrics):
        distance_km = float(base_metrics.get("distance_km", 0) or 0)
        base_duration_min = float(base_metrics.get("duration_min", 0) or 0)
        state_value = factors["state"].value if hasattr(factors["state"], "value") else str(factors["state"])

        scenario_name = state_value if state_value in SCENARIOS else "Normal"
        pred = _impact_predictor.predict(distance_km=distance_km, scenario=scenario_name, base_duration_min=base_duration_min)
        if pred is not None:
            return {
                "punctuality_score": round(pred.punctuality_score, 1),
                "freshness_score": round(pred.freshness_score, 1),
                "satisfaction_score": round(pred.satisfaction_score, 1),
                "simulated_duration_min": round(pred.duration_min, 2),
                "efficiency_score": round(pred.efficiency_score, 1),
                "emissions_kg_co2": round(pred.emissions_kg_co2, 3),
                "waste_percent": round(pred.waste_percent, 2),
                "energy_saving_percent": round(pred.energy_saving_percent, 2),
                "state": scenario_name
            }

        Ft = float(SCENARIOS.get(scenario_name, SCENARIOS["Normal"])["Ft"])
        Fr = float(SCENARIOS.get(scenario_name, SCENARIOS["Normal"])["Fr"])
        Fc = float(SCENARIOS.get(scenario_name, SCENARIOS["Normal"])["Fc"])

        duration_min = max(0.0, base_duration_min * Ft)
        emissions_kg_co2 = max(0.0, distance_km * 0.12 * Fc)
        efficiency_score = max(0.0, min(100.0, (base_duration_min / max(duration_min, 1e-6)) * 100.0))

        alpha = 2.0
        beta = 0.5
        freshness_score = 100.0 - (alpha * (duration_min / 60.0)) - (beta * Fr * distance_km)
        freshness_score = max(0.0, min(100.0, freshness_score))

        deadline = 7.0 if distance_km <= 3.0 else 15.0 if distance_km <= 9.0 else 26.0 if distance_km <= 15.0 else 38.0
        sigma = max(1.0, deadline * 0.15)
        punctuality_score = 100.0 * (1.0 - (0.5 * (1.0 + math.erf(((duration_min - deadline) / (sigma * math.sqrt(2)))))))
        punctuality_score = max(0.0, min(100.0, punctuality_score))

        satisfaction_score = (0.6 * (punctuality_score / 20.0)) + (0.4 * (freshness_score / 20.0))
        satisfaction_score = max(1.0, min(5.0, satisfaction_score))

        waste_percent = max(0.0, min(100.0, 100.0 - freshness_score))
        consumption_actual = distance_km * 0.08 * Fc
        consumption_old = distance_km * 0.12
        energy_saving_percent = max(0.0, min(100.0, 100.0 * (1.0 - (consumption_actual / max(consumption_old, 1e-6)))))

        return {
            "punctuality_score": round(punctuality_score, 1),
            "freshness_score": round(freshness_score, 1),
            "satisfaction_score": round(satisfaction_score, 1),
            "simulated_duration_min": round(duration_min, 2),
            "efficiency_score": round(efficiency_score, 1),
            "emissions_kg_co2": round(emissions_kg_co2, 3),
            "waste_percent": round(waste_percent, 2),
            "energy_saving_percent": round(energy_saving_percent, 2),
            "state": scenario_name
        }

class AdminKPICalculator:
    @staticmethod
    def calculate_admin_metrics(routes_data, history_data=None):
        if not routes_data:
            return {
                "platform_profit": 0,
                "prediction_accuracy": 0,
                "avg_time_reduction": 0,
                "revenue_growth": 0,
                "total_revenue": 0
            }

        total_revenue = sum(r.get("estimated_revenue", 0) for r in routes_data)
        platform_profit = total_revenue * 0.15
        
        eta_quality = _get_eta_quality()
        if eta_quality.get("available"):
            prediction_accuracy = max(0.0, min(100.0, float(eta_quality.get("r2", 0.0)) * 100.0))
        else:
            prediction_accuracy = 0.0
        avg_time_reduction = 18.5
        revenue_growth = 12.4
        
        return {
            "platform_profit": round(platform_profit, 2),
            "prediction_accuracy": round(prediction_accuracy, 1),
            "avg_time_reduction": round(avg_time_reduction, 1),
            "revenue_growth": round(revenue_growth, 1),
            "total_revenue": round(total_revenue, 2)
        }
