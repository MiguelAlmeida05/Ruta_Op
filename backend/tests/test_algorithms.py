import sys
import os
import networkx as nx
import unittest

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.routing.algorithms import PathFinder

class TestAlgorithms(unittest.TestCase):
    def setUp(self):
        # Create a simple test graph with realistic coordinates (Portoviejo area)
        self.G = nx.MultiDiGraph()
        # Node 1: Near Terminal Terrestre
        self.G.add_node(1, y=-1.0475, x=-80.4568)
        # Node 2: Near Parque Central
        self.G.add_node(2, y=-1.0544, x=-80.4528)
        # Node 3: Near ECU 911
        self.G.add_node(3, y=-1.0620, x=-80.4450)
        
        # Add edges with weights in seconds (realistic travel times)
        # 1 -> 2 is ~1km, approx 120s
        self.G.add_edge(1, 2, weight=120, length=1000)
        # 2 -> 3 is ~1km, approx 120s
        self.G.add_edge(2, 3, weight=120, length=1000)
        # 1 -> 3 is ~2.5km, approx 300s
        self.G.add_edge(1, 3, weight=300, length=2500)
        
        self.path_finder = PathFinder(self.G)

    def test_dijkstra_basic(self):
        result = self.path_finder.run_dijkstra(1, 3, weight='weight')
        self.assertEqual(result["path"], [1, 2, 3])
        self.assertEqual(result["cost"], 240)

    def test_dijkstra_direct(self):
        # Change weight to make direct path better
        self.G[1][3][0]['weight'] = 100
        result = self.path_finder.run_dijkstra(1, 3, weight='weight')
        self.assertEqual(result["path"], [1, 3])
        self.assertEqual(result["cost"], 100)

    def test_astar_basic(self):
        result = self.path_finder.run_astar(1, 3, weight='weight')
        self.assertEqual(result["path"], [1, 2, 3])
        self.assertEqual(result["cost"], 240)

if __name__ == "__main__":
    unittest.main()
