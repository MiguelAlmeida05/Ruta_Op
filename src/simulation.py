import networkx as nx
import numpy as np
import random
import copy

class TrafficSimulator:
    def __init__(self, G):
        self.original_graph = G.copy()
        
    def get_scenario_graph(self, scenario_type="base", intensity=0.0):
        """
        Returns a graph modified according to the scenario.
        scenario_type: 'base', 'congestion', 'closure', 'rain'
        intensity: 0.0 to 1.0 (severity)
        """
        G = copy.deepcopy(self.original_graph)
        
        if scenario_type == "base":
            return G
            
        elif scenario_type == "congestion":
            # Select random edges to increase weight
            start_time_high = 0.5 # 50% chance of high traffic on main roads if we had that info
            # For now, random selection
            num_edges = G.number_of_edges()
            edges_to_affect = int(num_edges * intensity) # e.g. 20% of edges
            
            all_edges = list(G.edges(keys=True, data=True))
            selected_edges = random.sample(all_edges, edges_to_affect)
            
            for u, v, k, data in selected_edges:
                # Congestion adds delay (multiplier 1.5x to 3x)
                delay_factor = 1.0 + (np.random.uniform(0.5, 2.0) * intensity)
                
                # Robustly handle weight type
                current_weight = data.get('weight', 1)
                if isinstance(current_weight, list):
                    current_weight = float(current_weight[0])
                else:
                    current_weight = float(current_weight)
                    
                data['weight'] = current_weight * delay_factor
                
                # Handle speed similarly
                current_speed = data.get('speed_kph', 30)
                if isinstance(current_speed, list):
                    current_speed = float(current_speed[0])
                else:
                    try:
                        current_speed = float(current_speed)
                    except (ValueError, TypeError):
                        current_speed = 30.0
                        
                data['speed_kph'] = current_speed / delay_factor
                
        elif scenario_type == "closure":
            # Remove edges
            num_edges = G.number_of_edges()
            edges_to_remove_count = int(num_edges * (intensity * 0.1)) # Max 10% closure usually
            
            all_edges = list(G.edges(keys=True))
            edges_to_remove = random.sample(all_edges, edges_to_remove_count)
            
            for u, v, k in edges_to_remove:
                if G.has_edge(u, v, k):
                    G.remove_edge(u, v, k)
                    
        return G

    def generate_synthetic_trips(self, n_trips=100):
        """Generates synthetic trip data for ML training."""
        trips = []
        nodes = list(self.original_graph.nodes())
        
        for _ in range(n_trips):
            u, v = random.sample(nodes, 2)
            try:
                # Use length as base, add noise
                # Simple approximation: shortest path length
                length = nx.shortest_path_length(self.original_graph, u, v, weight='length')
                
                # Base time (assuming ~30km/h avg in city)
                avg_speed_mps = 30 * 1000 / 3600
                base_time = length / avg_speed_mps
                
                # Add "real world" variance (weather, lights, traffic)
                noise = np.random.normal(1.0, 0.2) # multiplier
                actual_time = base_time * max(0.5, noise)
                
                trips.append({
                    "origin": u,
                    "destination": v,
                    "distance": length,
                    "avg_speed_network": avg_speed_mps,
                    "time_taken": actual_time
                })
            except nx.NetworkXNoPath:
                continue
                
        return trips
