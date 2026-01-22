import sys
import os
import networkx as nx
import rustworkx as rx

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from data_loader import DataLoader

def debug_rx():
    loader = DataLoader(data_dir=os.path.join(os.path.dirname(__file__), '..', 'data'))
    nx_graph = loader.load_graph()
    
    # Add OSM ID
    for node_id, data in nx_graph.nodes(data=True):
        data['osmid_temp'] = node_id
        
    rx_graph = rx.networkx_converter(nx_graph)
    
    print(f"NX nodes: {len(nx_graph.nodes())}, edges: {len(nx_graph.edges())}")
    print(f"RX nodes: {rx_graph.num_nodes()}, edges: {rx_graph.num_edges()}")
    
    # Check edge payload
    edges = rx_graph.edges()
    if len(edges) > 0:
        print(f"First edge payload type: {type(edges[0])}")
        print(f"First edge payload: {edges[0]}")
    
    # Check connectivity between a known pair
    # Pick a random edge from NX
    u, v, k, data = list(nx_graph.edges(keys=True, data=True))[0]
    print(f"Checking edge {u} -> {v} with data {data}")
    
    # Find indices
    osm_to_rx = {}
    for i, osmid in enumerate(rx_graph.nodes()):
        osm_to_rx[osmid] = i
        
    u_idx = osm_to_rx[u]
    v_idx = osm_to_rx[v]
    
    print(f"Mapped indices: {u_idx} -> {v_idx}")
    
    # Check if edge exists in RX
    has_edge = rx_graph.has_edge(u_idx, v_idx)
    print(f"RX has edge {u_idx} -> {v_idx}: {has_edge}")
    
    # Run simple path
    try:
        path = rx.dijkstra_shortest_path_lengths(rx_graph, u_idx, lambda x: 1.0, goal=v_idx)
        print(f"Path cost (1.0 weight): {path.get(v_idx)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_rx()
