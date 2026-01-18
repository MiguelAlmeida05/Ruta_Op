import networkx as nx
import heapq
import time
import math
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def haversine_heuristic(u, v, G):
    """
    Heuristic function for A* using Haversine distance.
    Assumes nodes have 'y' (lat) and 'x' (lon) attributes.
    
    Formula:
    a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
    c = 2 ⋅ atan2( √a, √(1−a) )
    d = R ⋅ c
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
    max_speed_mps = 25.0 
    return (R * c) / max_speed_mps

class PathFinder:
    def __init__(self, G: nx.MultiDiGraph):
        self.G = G

    def run_dijkstra(self, source, target, weight='weight', event_type=None):
        """
        Runs Dijkstra's algorithm and returns path and stats.
        Supports dynamic events: 'rain', 'traffic', 'protest'.
        
        Args:
            source: Source node ID
            target: Target node ID
            weight: Edge attribute for weight
            event_type: 'rain', 'traffic', 'protest' or None
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
                base_weight = float(edge_data.get(weight, 1))
                
                if base_weight < 0:
                    logger.warning(f"Negative weight found on edge {u}->{v}: {base_weight}. treating as 0.")
                    base_weight = 0

                # --- EVENT LOGIC ---
                penalty = 1.0
                
                if event_type == 'rain':
                    # Penalize secondary and unpaved roads
                    highway = edge_data.get('highway', '')
                    if isinstance(highway, list): highway = highway[0]
                    if highway in ['track', 'path', 'service', 'residential', 'tertiary']:
                        penalty = 2.5 # Slower due to mud/rain
                    elif highway in ['primary', 'secondary']:
                        penalty = 1.2 # Slight delay
                        
                elif event_type == 'traffic':
                    # Penalize primary roads (congestion)
                    highway = edge_data.get('highway', '')
                    if isinstance(highway, list): highway = highway[0]
                    if highway in ['primary', 'trunk', 'primary_link']:
                        penalty = 3.0 # Heavy traffic
                    elif highway in ['secondary', 'tertiary']:
                        penalty = 1.5 # Moderate traffic
                        
                elif event_type == 'protest':
                    # Block specific main avenues (simulate by huge penalty)
                    highway = edge_data.get('highway', '')
                    if isinstance(highway, list): highway = highway[0]
                    if highway in ['trunk', 'primary']:
                        penalty = 10.0 # Effectively blocked/avoid
                
                modified_weight = base_weight * penalty
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

    def run_astar(self, source, target, weight='weight'):
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
                edge_weight = float(data[0].get(weight, 1))
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
