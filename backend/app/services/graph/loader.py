import osmnx as ox
import networkx as nx
import pandas as pd
import os

class DataLoader:
    def __init__(self, place_name="Portoviejo, Ecuador", data_dir="data"):
        self.place_name = place_name
        self.data_dir = data_dir
        self.raw_dir = os.path.join(data_dir, "raw")
        self.processed_dir = os.path.join(data_dir, "processed")
        
        os.makedirs(self.raw_dir, exist_ok=True)
        os.makedirs(self.processed_dir, exist_ok=True)

    def load_graph(self, force_download=False):
        """Loads the graph from disk or downloads it if not present."""
        filepath = os.path.join(self.processed_dir, "portoviejo_graph.graphml")
        
        if not force_download and os.path.exists(filepath):
            print(f"Loading graph from {filepath}...")
            return ox.load_graphml(filepath)
        
        print(f"Downloading graph for {self.place_name}...")
        
        # Usar punto central y distancia para asegurar cobertura amplia (incluyendo periferias)
        # Centro aproximado entre Portoviejo urbano y zonas aledañas
        center_point = (-1.02, -80.42) 
        dist = 12000 # 12km de radio para cubrir desde el centro hasta zonas norte/sur lejanas
        
        print(f"Downloading graph from point {center_point} with dist={dist}m...")
        G = ox.graph_from_point(center_point, dist=dist, network_type='drive')
        
        # Add speeds and travel times
        G = self._enrich_graph(G)
        
        # Save
        print(f"Saving graph to {filepath}...")
        ox.save_graphml(G, filepath)
        return G

    def _enrich_graph(self, G):
        """Adds speed and travel_time attributes to edges."""
        # Impute missing speeds based on highway type
        G = ox.add_edge_speeds(G)
        # Calculate travel time (seconds) = length (meters) / speed (m/s)
        G = ox.add_edge_travel_times(G)
        
        # Ensure 'weight' attribute exists for algorithms (using time as weight)
        for u, v, k, data in G.edges(keys=True, data=True):
            # Clean up potential list values or strings
            try:
                tt = data.get('travel_time')
                if isinstance(tt, list):
                    tt = tt[0]
                data['weight'] = float(tt) if tt is not None else 1.0
            except (ValueError, TypeError):
                data['weight'] = 1.0
            
            try:
                l = data.get('length')
                if isinstance(l, list):
                    l = l[0]
                data['cost_length'] = float(l) if l is not None else 1.0
            except (ValueError, TypeError):
                data['cost_length'] = 1.0
            
        return G
