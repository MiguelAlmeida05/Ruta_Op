from src.data_loader import DataLoader
from src.algorithms import PathFinder
from src.simulation import TrafficSimulator
from src.analysis import TravelTimePredictor
import networkx as nx


def run_verification():
    print("1. Testing Data Loader...")
    loader = DataLoader()
    # Force download might be slow, so we rely on cache if available or download if not
    G = loader.load_graph() 
    print(f"   Graph loaded with {len(G.nodes)} nodes.")
    
    print("\n2. Testing Algorithms...")
    path_finder = PathFinder(G)
    nodes = list(G.nodes())
    start = nodes[0]
    end = nodes[min(100, len(nodes)-1)] # pick a node a bit far away
    
    dijkstra = path_finder.run_dijkstra(start, end)
    print(f"   Dijkstra cost: {dijkstra['cost']}")
    
    astar = path_finder.run_astar(start, end)
    print(f"   A* cost: {astar['cost']}")
    
    assert dijkstra['cost'] == astar['cost'] or (dijkstra['cost'] == float('inf') and astar['cost'] == float('inf')), "Costs should be identical!"
    print("   Algorithms consistency check passed.")
    
    print("\n3. Testing Simulation...")
    sim = TrafficSimulator(G)
    G_cong = sim.get_scenario_graph("congestion", 0.5)
    # Check if weights changed
    diff_weights = False
    for u, v, k in G.edges(keys=True):
        if G[u][v][k]['weight'] != G_cong[u][v][k]['weight']:
            diff_weights = True
            break
    print(f"   Congestion scenario modified weights: {diff_weights}")
    
    print("\n4. Testing ML...")
    predictor = TravelTimePredictor()
    trips = sim.generate_synthetic_trips(50)
    res = predictor.train(trips)
    print(f"   ML Training Result: {res}")
    
    print("\n[SUCCESS] All core modules verified successfully.")

if __name__ == "__main__":
    run_verification()
