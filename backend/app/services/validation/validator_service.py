import time
import random
import networkx as nx
import numpy as np
import logging
from app.services.simulation.engine import FactorSimulator, SimulationState, KPICalculator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ValidatorService:
    def __init__(self, graph, path_finder):
        self.graph = graph
        self.path_finder = path_finder

    def validate_routing_algorithms(self, samples=20):
        """
        Comparar Dijkstra vs A* en rutas aleatorias.
        """
        if not self.graph or not self.path_finder:
            return {"error": "Graph not initialized"}

        nodes = list(self.graph.nodes())
        if len(nodes) < 2:
            return {"error": "Not enough nodes"}

        results = {
            "samples": samples,
            "matches": 0,
            "dijkstra_avg_time_ms": 0,
            "astar_avg_time_ms": 0,
            "speedup_factor": 0,
            "cost_discrepancy_avg": 0
        }

        total_dijkstra_time = 0
        total_astar_time = 0
        cost_diff_sum = 0
        valid_samples = 0

        for _ in range(samples):
            u, v = random.sample(nodes, 2)
            
            d_res = self.path_finder.run_dijkstra(u, v)
            if not d_res['path']: continue 

            a_res = self.path_finder.run_astar(u, v)

            total_dijkstra_time += d_res['time_seconds']
            total_astar_time += a_res['time_seconds']

            diff = abs(d_res['cost'] - a_res['cost'])
            cost_diff_sum += diff
            
            if diff < 1e-6:
                results["matches"] += 1
            
            valid_samples += 1

        if valid_samples > 0:
            results["dijkstra_avg_time_ms"] = (total_dijkstra_time / valid_samples) * 1000
            results["astar_avg_time_ms"] = (total_astar_time / valid_samples) * 1000
            results["cost_discrepancy_avg"] = cost_diff_sum / valid_samples
            
            if results["astar_avg_time_ms"] > 0:
                results["speedup_factor"] = results["dijkstra_avg_time_ms"] / results["astar_avg_time_ms"]
        
        return results

    def validate_simulation_stability(self, n_simulations=500):
        """
        Ejecutar Monte Carlo N veces para un escenario fijo.
        """
        base_duration = 15.0 
        distance = 5.0 
        state = SimulationState.NORMAL

        durations = []
        punctuality_scores = []

        for _ in range(n_simulations):
            # Usar n_iterations=1 para probar la variabilidad inter-simulación si engine fuera puro MC
            # Pero engine ya hace promedio interno. Aquí testeamos la estabilidad de ESE promedio.
            res = FactorSimulator.simulate_factors(state, base_duration, distance, n_iterations=50)
            durations.append(res["simulated_duration"])
            
            kpis = KPICalculator.calculate_kpis(res, {"duration_min": base_duration})
            punctuality_scores.append(kpis["punctuality_score"])

        durations = np.array(durations)
        scores = np.array(punctuality_scores)

        mean_dur = np.mean(durations)
        std_dur = np.std(durations)
        
        ci_margin = 1.96 * (std_dur / np.sqrt(n_simulations))
        
        cv = (std_dur / mean_dur) * 100 if mean_dur > 0 else 0

        return {
            "n_simulations": n_simulations,
            "mean_duration": round(mean_dur, 2),
            "std_dev": round(std_dur, 2),
            "ci_95_lower": round(mean_dur - ci_margin, 2),
            "ci_95_upper": round(mean_dur + ci_margin, 2),
            "cv_percent": round(cv, 2),
            "mean_punctuality": round(np.mean(scores), 1)
        }
