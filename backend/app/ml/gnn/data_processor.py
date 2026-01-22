import os
import torch
import numpy as np
import pandas as pd
import networkx as nx
from torch_geometric.utils import from_networkx
from torch_geometric.data import Data
from datetime import datetime, timedelta
import random

class TrafficDataProcessor:
    def __init__(self, graph, data_dir="data/gnn_dataset"):
        self.graph = graph
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        
        # Mappings para encoding
        self.road_types = {
            'residential': 0, 'tertiary': 1, 'secondary': 2, 
            'primary': 3, 'trunk': 4, 'motorway': 5, 'unclassified': 6
        }
        
    def _encode_road_type(self, road_type):
        if isinstance(road_type, list):
            road_type = road_type[0]
        return self.road_types.get(road_type, 6) # Default unclassified

    def _get_node_features(self, G):
        """Extract node features: [x, y, out_degree, in_degree]"""
        xs = []
        for u, data in G.nodes(data=True):
            # Normalize coords roughly for Portoviejo
            norm_x = (data['x'] + 80.45) * 100 
            norm_y = (data['y'] + 1.05) * 100
            deg_out = G.out_degree(u)
            deg_in = G.in_degree(u)
            xs.append([norm_x, norm_y, deg_out, deg_in])
        return torch.tensor(xs, dtype=torch.float)

    def _get_edge_features(self, G):
        """Extract edge features: [length, speed_limit, road_type_idx]"""
        edge_attrs = []
        for u, v, k, data in G.edges(keys=True, data=True):
            length = float(data.get('length', 100)) / 1000.0 # km
            
            speed = data.get('speed_kph', 30)
            if isinstance(speed, list): speed = float(speed[0])
            else: speed = float(speed)
            
            highway = data.get('highway', 'unclassified')
            road_type_idx = self._encode_road_type(highway)
            
            edge_attrs.append([length, speed / 100.0, road_type_idx])
            
        return torch.tensor(edge_attrs, dtype=torch.float)

    def generate_synthetic_dataset(self, days=7, samples_per_day=24):
        """
        Generates a sequence of graph snapshots with synthetic traffic data.
        Returns a list of PyG Data objects.
        """
        print(f"Generating synthetic traffic dataset for {days} days...")
        snapshots = []
        
        # Base static features
        x = self._get_node_features(self.graph)
        
        # To ensure alignment, let's relabel nodes to integers 0..N-1
        mapping = {node: i for i, node in enumerate(self.graph.nodes())}
        G_relabeled = nx.relabel_nodes(self.graph, mapping)
        
        edge_index = []
        edge_attr_static = []
        
        # Re-extract with correct order
        for u, v, data in G_relabeled.edges(data=True):
            edge_index.append([u, v])
            
            # Static attrs
            length = float(data.get('length', 100)) / 1000.0
            speed = data.get('speed_kph', 30)
            if isinstance(speed, list): speed = float(speed[0])
            else: speed = float(speed) if speed else 30.0
            highway = data.get('highway', 'unclassified')
            
            edge_attr_static.append([length, speed / 100.0, self._encode_road_type(highway)])

        edge_index = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
        edge_attr_static = torch.tensor(edge_attr_static, dtype=torch.float)
        x = self._get_node_features(G_relabeled)

        start_date = datetime.now() - timedelta(days=days)
        
        for d in range(days):
            current_day = start_date + timedelta(days=d)
            is_weekend = current_day.weekday() >= 5
            
            for h in range(samples_per_day):
                hour = h
                
                # Synthetic Congestion Logic
                is_peak = False
                if not is_weekend and (7 <= hour <= 9 or 17 <= hour <= 19):
                    is_peak = True
                
                # Create snapshot targets
                y_congestion = []
                
                for i in range(edge_index.shape[1]):
                    p_congestion = 0.05
                    if is_peak: p_congestion += 0.3
                    
                    noise = random.uniform(0, 0.2)
                    congestion_level = 0.0
                    
                    if random.random() < p_congestion:
                        congestion_level = random.uniform(0.6, 1.0)
                    else:
                        congestion_level = random.uniform(0.0, 0.3)
                    
                    y_congestion.append(congestion_level)
                
                y = torch.tensor(y_congestion, dtype=torch.float).view(-1, 1)
                
                data = Data(x=x, edge_index=edge_index, edge_attr=edge_attr_static, y=y)
                data.hour = hour
                data.is_weekend = is_weekend
                snapshots.append(data)
                
        print(f"Generated {len(snapshots)} snapshots.")
        return snapshots
