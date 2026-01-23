import unittest
import networkx as nx
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.routing.algorithms import PathFinder, haversine_heuristic
from app.services.simulation.engine import FactorSimulator, SimulationState, KPICalculator

class TestAlgorithms(unittest.TestCase):
    def setUp(self):
        # Create a simple graph for testing
        self.G = nx.MultiDiGraph()
        # Add nodes with coordinates (approx lat/lon for distance calc)
        # Node 1: (0, 0)
        # Node 2: (0, 0.01) -> approx 1.11km east
        self.G.add_node(1, y=0, x=0)
        self.G.add_node(2, y=0, x=0.01)
        self.G.add_edge(1, 2, weight=10, highway='primary')
        self.path_finder = PathFinder(self.G)

    def test_haversine(self):
        # Distance between (0,0) and (0, 0.01) is approx 1113.2 meters
        # Max speed 40 m/s (144 km/h) -> time approx 27.8s
        heuristic = haversine_heuristic(1, 2, self.G)
        self.assertTrue(24 < heuristic < 32)

    def test_dijkstra_path_exists(self):
        result = self.path_finder.run_dijkstra(1, 2)
        self.assertEqual(result['path'], [1, 2])
        self.assertEqual(result['cost'], 10)

    def test_dijkstra_no_path(self):
        result = self.path_finder.run_dijkstra(2, 1) # Reverse direction not added
        self.assertEqual(result['path'], [])
        self.assertEqual(result['cost'], float('inf'))

    def test_dijkstra_invalid_node(self):
        result = self.path_finder.run_dijkstra(1, 99)
        self.assertIn("error", result)

class TestSimulation(unittest.TestCase):
    def test_calibrate_base_time_short(self):
        # Distance 1km (<2.5) -> should be between 3 and 6
        time = FactorSimulator.calibrate_base_time(1.0, 1.0)
        self.assertTrue(3 <= time <= 6)

    def test_calibrate_base_time_negative(self):
        # Should clamp to 0 and calculate based on 0 distance (approx 3 min)
        time = FactorSimulator.calibrate_base_time(-5.0, -10.0)
        self.assertGreater(time, 0)

    def test_simulate_factors_iterations(self):
        res = FactorSimulator.simulate_factors(SimulationState.NORMAL, 10, 5, n_iterations=10)
        self.assertIn('simulated_duration', res)
        self.assertIn('state', res)

    def test_kpi_calculation(self):
        factors = {
            "simulated_duration": 12.0,
            "initial_freshness": 98.0,
            "degradation_rate": 0.02,
            "fuel_factor": 1.1,
            "state": SimulationState.NORMAL
        }
        base_metrics = {"duration_min": 10.0}
        
        kpis = KPICalculator.calculate_kpis(factors, base_metrics)
        self.assertLessEqual(kpis['punctuality_score'], 100)
        self.assertGreaterEqual(kpis['punctuality_score'], 0)
        
if __name__ == '__main__':
    unittest.main()
