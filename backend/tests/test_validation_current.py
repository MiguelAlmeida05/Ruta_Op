
import unittest
import networkx as nx
import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.routing.algorithms import PathFinder
from app.services.simulation.engine import MarkovChain, SimulationState, FactorSimulator

class TestSystemValidation(unittest.TestCase):
    """
    Validation suite for the current system state.
    Tests core algorithms and simulation logic without external dependencies.
    """

    def setUp(self):
        # Setup a controlled graph environment
        self.G = nx.MultiDiGraph()
        # Triangle topology: 1 -> 2 -> 3, and 1 -> 3 directly
        self.G.add_node(1, y=0, x=0)
        self.G.add_node(2, y=0, x=1) # 1 unit east
        self.G.add_node(3, y=1, x=1) # 1 unit north of 2
        
        # Edges
        # Path A: 1->2 (cost 10), 2->3 (cost 10) -> Total 20
        self.G.add_edge(1, 2, weight=10, length=1000, highway='primary')
        self.G.add_edge(2, 3, weight=10, length=1000, highway='primary')
        
        # Path B: 1->3 (cost 25) -> Total 25
        self.G.add_edge(1, 3, weight=25, length=2200, highway='secondary')
        
        self.pf = PathFinder(self.G)

    def test_pathfinding_logic(self):
        """Validates that Dijkstra finds the optimal path."""
        result = self.pf.run_dijkstra(1, 3)
        self.assertEqual(result['cost'], 20)
        self.assertEqual(result['path'], [1, 2, 3])
        
    def test_event_handling_traffic(self):
        """Validates that Traffic event penalizes primary roads."""
        # Traffic penalizes 'primary' by 8.0 (from algorithms.py logic)
        # 1->2 becomes 80, 2->3 becomes 80. Total Path A = 160.
        # 1->3 (secondary) penalizes by 3.0 -> 25 * 3.0 = 75.
        # Optimal path should switch to 1->3.
        
        result = self.pf.run_dijkstra(1, 3, event_type='traffic')
        
        self.assertEqual(result['path'], [1, 3])
        self.assertEqual(result['cost'], 75.0)

    def test_markov_chain_integrity(self):
        """Validates Markov Chain probabilities sum to 1."""
        mc = MarkovChain()
        for state, transitions in mc.transition_matrix.items():
            prob_sum = sum(transitions.values())
            self.assertAlmostEqual(prob_sum, 1.0, places=5, 
                                   msg=f"Probabilities for {state} do not sum to 1")

    def test_factor_simulator_calibration(self):
        """Validates the base time calibration logic."""
        # < 2.5km logic
        # 1km -> should be calibrated to > 3 min
        calibrated = FactorSimulator.calibrate_base_time(1.0, 1.0) # 1 min input
        self.assertGreater(calibrated, 3.0)
        
        # > 15km logic (rango realista)
        calibrated_long = FactorSimulator.calibrate_base_time(20.0, 10.0)
        self.assertGreaterEqual(calibrated_long, 27.0)
        self.assertLessEqual(calibrated_long, 38.0)

if __name__ == '__main__':
    unittest.main()
