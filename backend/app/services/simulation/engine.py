import random
from enum import Enum
import math
import logging
import threading
from typing import Dict, Optional
import uuid
from app.ml.eta_predictor import ETAPredictor
from app.core.logger import get_logger

# Configure logging
logger = get_logger(__name__)

# Global ML Predictor instance
_eta_predictor = ETAPredictor()

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

class FactorSimulator:
    @staticmethod
    def calibrate_base_time(distance_km: float, raw_duration_min: float) -> float:
        """
        Calibra el tiempo base según la distancia para ajustarse a rangos realistas.
        - < 2 km: 3-6 min (Avg 4.5)
        - 3-8 km: 10-18 min (Avg 14)
        - 9-15 km: 19-30 min (Avg 24.5)
        - > 15 km: Proyección lineal
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

        if distance_km < 2.5:
            # Slower: 4-8 min for short distances (traffic, lights)
            calibrated = 4 + (distance_km / 2.5) * 4 
        elif distance_km < 9.0:
            # Slower: 12-25 min for medium distances
            slope = (25 - 12) / (9.0 - 2.5)
            calibrated = 12 + (distance_km - 2.5) * slope
        else:
            # Slower: 26-45 min for long distances
            slope = (45 - 26) / (15.0 - 9.0)
            calibrated = 26 + (distance_km - 9.0) * slope

        # Factor de Realidad (Ajuste basado en feedback de usuario: 5.67 -> 6.07)
        REALITY_FACTOR = 1.0705
        
        return max(raw_duration_min, calibrated) * REALITY_FACTOR

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
        sim_duration = factors["simulated_duration"]
        init_fresh = factors["initial_freshness"]
        deg_rate = factors["degradation_rate"]
        fuel_factor = factors["fuel_factor"]
        
        est_duration = base_metrics["duration_min"]
        
        # 1. Fiabilidad
        if est_duration > 0:
            delay = max(0, sim_duration - est_duration)
            reliability = max(0, 1.0 - (delay / est_duration))
        else:
            reliability = 1.0
        
        punctuality_score = round(reliability * 100, 1)
        
        # 2. Calidad y Frescura
        total_degradation = deg_rate * sim_duration
        freshness_final = max(0, init_fresh - total_degradation)
        freshness_score = round(freshness_final, 1)
        
        # 3. Satisfacción
        base_sat = random.triangular(4.2, 5.0, 4.7)
        penalties = 0
        if punctuality_score < 90:
            penalties += (90 - punctuality_score) * 0.05
        if freshness_score < 90:
            penalties += (90 - freshness_score) * 0.03
            
        satisfaction_score = max(1.0, min(5.0, base_sat - penalties))
        satisfaction_score = round(satisfaction_score, 1)
        
        # 5. Eficiencia
        efficiency = max(0, (1.5 - fuel_factor) / 1.5) * 100
        
        return {
            "punctuality_score": punctuality_score,
            "freshness_score": freshness_score,
            "satisfaction_score": satisfaction_score,
            "simulated_duration_min": round(sim_duration, 2),
            "efficiency_score": round(efficiency, 1),
            "state": factors["state"].value
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
        
        # Valores simulados/fijos por ahora
        prediction_accuracy = 95.0
        avg_time_reduction = 18.5
        revenue_growth = 12.4
        
        return {
            "platform_profit": round(platform_profit, 2),
            "prediction_accuracy": round(prediction_accuracy, 1),
            "avg_time_reduction": round(avg_time_reduction, 1),
            "revenue_growth": round(revenue_growth, 1),
            "total_revenue": round(total_revenue, 2)
        }
