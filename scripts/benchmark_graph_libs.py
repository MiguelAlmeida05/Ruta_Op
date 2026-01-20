import time
import networkx as nx
import rustworkx as rx
import random
import os
import sys
import math

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from data_loader import DataLoader
from algorithms import PathFinder

def run_benchmark():
    print("Loading graph...")
    loader = DataLoader(data_dir=os.path.join(os.path.dirname(__file__), '..', 'data'))
    nx_graph = loader.load_graph()
    print(f"Graph loaded: {nx_graph.number_of_nodes()} nodes, {nx_graph.number_of_edges()} edges")

    # Initialize PathFinder (which uses Rustworkx internally now)
    print("Initializing PathFinder (Rustworkx)...")
    pf = PathFinder(nx_graph)
    
    # Create a legacy PathFinder (force NX fallback by breaking RX)
    # This is a bit hacky, but valid for comparison
    pf_nx = PathFinder(nx_graph)
    pf_nx.rx_graph = None # Force fallback

    nodes = list(nx_graph.nodes())
    if len(nodes) < 100:
        print("Graph too small for benchmark")
        return

    # Select random pairs
    num_pairs = 100
    pairs = []
    for _ in range(num_pairs):
        u = random.choice(nodes)
        v = random.choice(nodes)
        pairs.append((u, v))

    print(f"\nRunning benchmark on {num_pairs} random paths...")

    # --- NetworkX Benchmark (via PathFinder fallback) ---
    start_time = time.time()
    nx_costs = []
    for u, v in pairs:
        res = pf_nx.run_dijkstra(u, v)
        nx_costs.append(res.get('cost', float('inf')))
    nx_total_time = time.time() - start_time
    print(f"NetworkX (PathFinder fallback) Average Time: {nx_total_time / num_pairs * 1000:.2f} ms")
    print(f"NetworkX Total Time: {nx_total_time:.4f} s")

    # --- Rustworkx Benchmark (via PathFinder) ---
    start_time = time.time()
    rx_costs = []
    for u, v in pairs:
        res = pf.run_dijkstra(u, v)
        rx_costs.append(res.get('cost', float('inf')))
    rx_total_time = time.time() - start_time
    print(f"Rustworkx (PathFinder) Average Time: {rx_total_time / num_pairs * 1000:.2f} ms")
    print(f"Rustworkx Total Time: {rx_total_time:.4f} s")

    # --- Results ---
    speedup = nx_total_time / rx_total_time if rx_total_time > 0 else 0
    print(f"\nSpeedup: {speedup:.2f}x")

    # Verification
    matches = 0
    for c1, c2 in zip(nx_costs, rx_costs):
        if c1 == float('inf') and c2 == float('inf'):
            matches += 1
        elif abs(c1 - c2) < 1e-6:
            matches += 1
    
    print(f"Cost Consistency: {matches}/{num_pairs} matches")

if __name__ == "__main__":
    run_benchmark()
