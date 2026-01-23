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

        requested_samples = int(max(1, samples))
        results = {
            "samples": requested_samples,
            "matches": 0,
            "dijkstra_avg_time_ms": 0,
            "astar_avg_time_ms": 0,
            "speedup_factor": 0,
            "cost_discrepancy_avg": 0,
        }

        total_dijkstra_time = 0
        total_astar_time = 0
        cost_diff_sum = 0
        valid_samples = 0
        dijkstra_times_ms = []
        astar_times_ms = []
        cost_diffs = []
        per_event = {}
        event_types = [None, "rain", "traffic", "protest"]

        max_attempts = max(200, requested_samples * 40)
        attempts = 0

        while valid_samples < requested_samples and attempts < max_attempts:
            attempts += 1
            u, v = random.sample(nodes, 2)

            d_res = self.path_finder.run_dijkstra(u, v)
            if not d_res.get("path"):
                continue

            a_res = self.path_finder.run_astar(u, v)
            if not a_res.get("path"):
                continue

            d_t = float(d_res.get("time_seconds") or 0.0)
            a_t = float(a_res.get("time_seconds") or 0.0)
            total_dijkstra_time += d_t
            total_astar_time += a_t
            dijkstra_times_ms.append(d_t * 1000.0)
            astar_times_ms.append(a_t * 1000.0)

            diff = abs(float(d_res.get("cost") or 0.0) - float(a_res.get("cost") or 0.0))
            cost_diff_sum += diff
            cost_diffs.append(float(diff))

            if diff < 1e-6:
                results["matches"] += 1

            valid_samples += 1

        results["samples"] = valid_samples

        if valid_samples > 0:
            results["dijkstra_avg_time_ms"] = (total_dijkstra_time / valid_samples) * 1000
            results["astar_avg_time_ms"] = (total_astar_time / valid_samples) * 1000
            results["cost_discrepancy_avg"] = cost_diff_sum / valid_samples
            
            if results["astar_avg_time_ms"] > 0:
                results["speedup_factor"] = results["dijkstra_avg_time_ms"] / results["astar_avg_time_ms"]

        if dijkstra_times_ms and astar_times_ms:
            results["dijkstra_times_ms"] = dijkstra_times_ms[: min(len(dijkstra_times_ms), 120)]
            results["astar_times_ms"] = astar_times_ms[: min(len(astar_times_ms), 120)]
            results["cost_diffs"] = cost_diffs[: min(len(cost_diffs), 120)]

        for event_type in event_types:
            key = "none" if event_type is None else str(event_type)
            d_time = 0.0
            a_time = 0.0
            diff_sum = 0.0
            valid = 0
            matches = 0
            attempts = 0
            while valid < requested_samples and attempts < max_attempts:
                attempts += 1
                u, v = random.sample(nodes, 2)
                d_res = self.path_finder.run_dijkstra(u, v, event_type=event_type)
                if not d_res.get("path"):
                    continue
                a_res = self.path_finder.run_astar(u, v, event_type=event_type)
                if not a_res.get("path"):
                    continue

                d_time += float(d_res.get("time_seconds") or 0.0)
                a_time += float(a_res.get("time_seconds") or 0.0)
                diff = abs(float(d_res.get("cost") or 0.0) - float(a_res.get("cost") or 0.0))
                diff_sum += diff
                if diff < 1e-6:
                    matches += 1
                valid += 1

            item = {"samples": valid, "valid": valid, "matches": matches, "cost_discrepancy_avg": 0.0, "speedup_factor": 1.0}
            if valid > 0:
                item["cost_discrepancy_avg"] = diff_sum / valid
                d_ms = (d_time / valid) * 1000.0
                a_ms = (a_time / valid) * 1000.0
                item["dijkstra_avg_time_ms"] = d_ms
                item["astar_avg_time_ms"] = a_ms
                item["speedup_factor"] = (d_ms / a_ms) if a_ms > 0 else 1.0
            per_event[key] = item

        results["per_event"] = per_event
        
        return results

    def validate_simulation_stability(self, n_simulations=500):
        """
        Ejecutar Monte Carlo N veces para un escenario fijo.
        """
        base_duration = 15.0
        distance = 5.0

        durations = []
        punctuality_scores = []

        for _ in range(n_simulations):
            state = random.choices(
                [SimulationState.NORMAL, SimulationState.RAIN, SimulationState.TRAFFIC, SimulationState.STRIKE],
                weights=[0.55, 0.18, 0.22, 0.05],
            )[0]
            base_d = max(6.0, float(random.gauss(base_duration, 2.0)))
            dist = max(1.0, float(random.gauss(distance, 1.2)))
            res = FactorSimulator.simulate_factors(state, base_d, dist, n_iterations=8)
            durations.append(res["simulated_duration"])
            
            kpis = KPICalculator.calculate_kpis(res, {"duration_min": base_d})
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
            "mean_punctuality": round(np.mean(scores), 1),
            "durations_sample": durations[: min(len(durations), 180)].round(3).tolist(),
            "punctuality_sample": scores[: min(len(scores), 180)].round(3).tolist(),
        }
