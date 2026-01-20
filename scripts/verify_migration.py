import sys
import os
import time
import networkx as nx

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from data_loader import DataLoader
from algorithms import PathFinder

import logging

# Configure logging to stdout
logging.basicConfig(level=logging.INFO, format='%(name)s - %(levelname)s - %(message)s')

def verify():
    print("Loading graph...")
    loader = DataLoader(data_dir=os.path.join(os.path.dirname(__file__), '..', 'data'))
    G = loader.load_graph()
    
    print("Initializing PathFinder...")
    pf = PathFinder(G)
    
    # Check if RX graph is initialized
    if hasattr(pf, 'rx_graph') and pf.rx_graph is not None:
        print("SUCCESS: Rustworkx graph initialized.")
        print(f"RX Nodes: {pf.rx_graph.num_nodes()}")
    else:
        print("FAILURE: Rustworkx graph NOT initialized.")
        return

    # Run Dijkstra
    nodes = list(G.nodes())
    if len(nodes) < 2:
        print("Not enough nodes.")
        return
        
    u = nodes[0]
    v = nodes[-1] # Pick distant nodes hopefully
    
    print(f"Running Dijkstra from {u} to {v}...")
    res = pf.run_dijkstra(u, v)
    
    print(f"Algorithm used: {res.get('algorithm')}")
    print(f"Time: {res.get('time_seconds')*1000:.2f} ms")
    print(f"Cost: {res.get('cost')}")
    print(f"Path length: {len(res.get('path'))}")
    
    if res.get('algorithm') == "Dijkstra (RX)":
        print("VERIFICATION PASSED: Using Rustworkx implementation.")
    else:
        print("VERIFICATION FAILED: Fallback to NetworkX occurred.")

if __name__ == "__main__":
    verify()
