import networkx as nx
import rustworkx as rx
import heapq
import time
import math
import logging
from app.core.logger import get_logger

# Configure logging
logger = get_logger(__name__)

def normalize_highway(edge_data):
    highway = edge_data.get('highway', '')
    if isinstance(highway, list):
        return highway[0]
    return highway

def apply_penalties(base_weight, highway, event_type, vehicle_profile):
    penalty = 1.0
    if event_type == 'rain':
        if highway in ['track', 'path', 'service', 'residential', 'tertiary']:
            penalty *= 2.5
        elif highway in ['primary', 'secondary']:
            penalty *= 1.2
    elif event_type == 'traffic':
        if highway in ['primary', 'trunk', 'primary_link']:
            penalty *= 8.0
        elif highway in ['secondary', 'tertiary']:
            penalty *= 3.0
    elif event_type == 'protest':
        if highway in ['trunk', 'primary']:
            penalty *= 10.0

    if vehicle_profile:
        speed_penalty = vehicle_profile.get("speed_penalty", 1.0)
        avoid_highways = vehicle_profile.get("avoid_highways", [])
        avoid_penalty = vehicle_profile.get("avoid_penalty", 1.0)
        penalty *= speed_penalty
        if highway in avoid_highways:
            penalty *= avoid_penalty

    return base_weight * penalty

def haversine_heuristic(u, v, G):
    """
    Heuristic function for A* using Haversine distance.
    Assumes nodes have 'y' (lat) and 'x' (lon) attributes.
    """
    if u not in G or v not in G:
        logger.error(f"Node {u} or {v} not found in graph")
        return float('inf')

    u_node = G.nodes[u]
    v_node = G.nodes[v]
    
    # Validate coordinates
    if 'y' not in u_node or 'x' not in u_node or 'y' not in v_node or 'x' not in v_node:
         logger.warning(f"Missing coordinates for nodes {u} or {v}")
         return 0

    R = 6371000  # Radius of Earth in meters
    phi1 = math.radians(u_node['y'])
    phi2 = math.radians(v_node['y'])
    delta_phi = math.radians(v_node['y'] - u_node['y'])
    delta_lambda = math.radians(v_node['x'] - u_node['x'])
    
    a = math.sin(delta_phi / 2)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    # Return estimated time (seconds) assuming max speed (e.g., 90 km/h = 25 m/s)
    # This keeps the heuristic admissible (never overestimates if we use max possible speed)
    # Adjusted to 15 m/s (54 km/h) to be more realistic for city driving
    max_speed_mps = 15.0 
    return (R * c) / max_speed_mps

class PathFinder:
    def __init__(self, G: nx.MultiDiGraph):
        self.G = G
        self._init_rustworkx()

    def _init_rustworkx(self):
        """Initializes the Rustworkx graph and mappings."""
        # Add OSM ID to attributes to preserve it
        for node_id, data in self.G.nodes(data=True):
            data['osmid_temp'] = node_id
            
        try:
            self.rx_graph = rx.networkx_converter(self.G)
        except Exception as e:
            logger.error(f"Failed to convert to Rustworkx: {e}")
            self.rx_graph = None
            return

        self.osm_to_rx = {}
        self.rx_to_osm = {}
        
        # Build mapping from Rustworkx nodes (payload is OSM ID)
        for i, osmid in enumerate(self.rx_graph.nodes()):
            self.osm_to_rx[osmid] = i
            self.rx_to_osm[i] = osmid

        # Cleanup
        for node_id, data in self.G.nodes(data=True):
            if 'osmid_temp' in data:
                del data['osmid_temp']

    def run_dijkstra(self, source, target, weight='weight', event_type=None, vehicle_profile=None):
        """
        Runs Dijkstra's algorithm and returns path and stats.
        Uses Rustworkx for performance, falls back to NetworkX if needed.
        Supports dynamic events: 'rain', 'traffic', 'protest'.
        """
        if self.rx_graph and source in self.osm_to_rx and target in self.osm_to_rx:
            return self._run_dijkstra_rx(source, target, weight, event_type, vehicle_profile)
            
        return self._run_dijkstra_nx(source, target, weight, event_type, vehicle_profile)

    def _run_dijkstra_rx(self, source, target, weight_attr, event_type, vehicle_profile):
        start_time = time.time()
        u_idx = self.osm_to_rx[source]
        v_idx = self.osm_to_rx[target]
        
        def weight_fn(edge_data):
            # Handle string weights from GraphML
            try:
                base_weight = float(edge_data.get(weight_attr, 1.0))
            except (ValueError, TypeError):
                base_weight = 1.0
                
            if base_weight < 0: base_weight = 0
            
            highway = normalize_highway(edge_data)
            return apply_penalties(base_weight, highway, event_type, vehicle_profile)

        try:
            # Get path indices
            paths = rx.dijkstra_shortest_paths(self.rx_graph, u_idx, target=v_idx, weight_fn=weight_fn)
            if v_idx in paths:
                path_indices = paths[v_idx]
            else:
                path_indices = None
            
            if not path_indices:
                logger.warning(f"No path found between {source} and {target} (RX)")
                return {"algorithm": "Dijkstra (RX)", "path": [], "cost": float('inf'), "error": "No path"}
                
            # Convert indices back to OSM IDs
            final_path = [self.rx_to_osm[i] for i in path_indices]
            
            # Calculate cost manually
            cost = 0.0
            for i in range(len(path_indices) - 1):
                u, v = path_indices[i], path_indices[i+1]
                # In multigraph, there might be multiple edges.
                # Dijkstra picks the one with lowest weight.
                edges = self.rx_graph.get_all_edge_data(u, v)
                min_edge_weight = float('inf')
                for edge_data in edges:
                    w = weight_fn(edge_data)
                    if w < min_edge_weight:
                        min_edge_weight = w
                
                # Check for invalid weights
                if math.isinf(min_edge_weight):
                    logger.warning(f"Infinite weight detected on edge {u}-{v}")
                    continue
                    
                cost += min_edge_weight
            
            # Final sanity check on cost
            if math.isinf(cost) or math.isnan(cost):
                 logger.error(f"Calculated cost is invalid: {cost}")
                 cost = float('inf')

            end_time = time.time()
            return {
                "algorithm": "Dijkstra (RX)",
                "path": final_path,
                "cost": cost,
                "explored_nodes": -1, # Not available in RX
                "time_seconds": end_time - start_time
            }
            
        except Exception as e:
            logger.error(f"Error in RX Dijkstra: {e}")
            return self._run_dijkstra_nx(source, target, weight_attr, event_type)

    def _run_dijkstra_nx(self, source, target, weight='weight', event_type=None, vehicle_profile=None):
        """
        Original NetworkX implementation.
        """
        if source not in self.G or target not in self.G:
            logger.error(f"Source {source} or Target {target} not in graph")
            return {"algorithm": "Dijkstra", "path": [], "cost": float('inf'), "error": "Node not found"}

        start_time = time.time()
        explored_count = 0
        
        # Priority queue: (cost, node)
        pq = [(0, source)]
        visited = set()
        min_dist = {source: 0}
        parents = {source: None}
        
        final_path = []
        cost = float('inf')
        
        while pq:
            current_cost, u = heapq.heappop(pq)
            
            if u in visited:
                continue
            
            visited.add(u)
            explored_count += 1
            
            if u == target:
                # Reconstruct path
                curr = u
                while curr is not None:
                    final_path.append(curr)
                    curr = parents[curr]
                final_path.reverse()
                cost = current_cost
                break
            
            for v, data in self.G[u].items():
                edge_data = data[0] # Multigraph
                try:
                    base_weight = float(edge_data.get(weight, 1))
                except:
                    base_weight = 1.0
                
                if base_weight < 0:
                    logger.warning(f"Negative weight found on edge {u}->{v}: {base_weight}. treating as 0.")
                    base_weight = 0

                # --- EVENT LOGIC ---
                highway = normalize_highway(edge_data)
                modified_weight = apply_penalties(base_weight, highway, event_type, vehicle_profile)
                new_cost = current_cost + modified_weight
                
                if new_cost < min_dist.get(v, float('inf')):
                    min_dist[v] = new_cost
                    parents[v] = u
                    heapq.heappush(pq, (new_cost, v))
                    
        end_time = time.time()
        
        if not final_path:
             logger.warning(f"No path found between {source} and {target}")

        return {
            "algorithm": "Dijkstra",
            "path": final_path,
            "cost": cost,
            "explored_nodes": explored_count,
            "time_seconds": end_time - start_time
        }

    def run_astar(self, source, target, weight='weight', event_type=None):
        """
        Runs A* algorithm and returns path and stats.
        Uses Haversine heuristic.
        """
        if source not in self.G or target not in self.G:
            logger.error(f"Source {source} or Target {target} not in graph")
            return {"algorithm": "A*", "path": [], "cost": float('inf'), "error": "Node not found"}

        start_time = time.time()
        explored_count = 0
        
        # Priority queue: (f_score, cost, node)
        pq = [(0, 0, source)]
        visited = set()
        min_dist = {source: 0}
        parents = {source: None}
        
        final_path = []
        cost = float('inf')
        
        while pq:
            _, current_cost, u = heapq.heappop(pq)
            
            if u in visited:
                continue
            
            visited.add(u)
            explored_count += 1
            
            if u == target:
                # Reconstruct path
                curr = u
                while curr is not None:
                    final_path.append(curr)
                    curr = parents[curr]
                final_path.reverse()
                cost = current_cost
                break
            
            for v, data in self.G[u].items():
                try:
                    edge_weight = float(data[0].get(weight, 1))
                except:
                    edge_weight = 1.0
                if edge_weight < 0:
                     edge_weight = 0
                     
                new_cost = current_cost + edge_weight
                
                if new_cost < min_dist.get(v, float('inf')):
                    min_dist[v] = new_cost
                    parents[v] = u
                    heuristic = haversine_heuristic(v, target, self.G)
                    f_score = new_cost + heuristic
                    heapq.heappush(pq, (f_score, new_cost, v))

        end_time = time.time()
        
        return {
            "algorithm": "A*",
            "path": final_path,
            "cost": cost,
            "explored_nodes": explored_count,
            "time_seconds": end_time - start_time
        }
