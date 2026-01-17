import networkx as nx
import heapq
import time
import math

def haversine_heuristic(u, v, G):
    """
    Heuristic function for A* using Haversine distance.
    Assumes nodes have 'y' (lat) and 'x' (lon) attributes.
    """
    u_node = G.nodes[u]
    v_node = G.nodes[v]
    
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
    def __init__(self, G):
        self.G = G

    def run_dijkstra(self, source, target, weight='weight'):
        """
        Runs Dijkstra's algorithm and returns path and stats.
        """
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
                edge_weight = float(data[0].get(weight, 1))
                new_cost = current_cost + edge_weight
                
                if new_cost < min_dist.get(v, float('inf')):
                    min_dist[v] = new_cost
                    parents[v] = u
                    heapq.heappush(pq, (new_cost, v))
                    
        end_time = time.time()
        
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
        """
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
