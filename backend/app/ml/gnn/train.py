import os
import sys
import torch
import torch.nn as nn
import torch.optim as optim
from tqdm import tqdm
import numpy as np

# Add backend/app root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
# current_dir = backend/app/ml/gnn
app_ml_dir = os.path.dirname(current_dir)
app_dir = os.path.dirname(app_ml_dir)
backend_root = os.path.dirname(app_dir)
sys.path.append(backend_root)

from app.services.graph.loader import DataLoader
from app.ml.gnn.data_processor import TrafficDataProcessor
from app.ml.gnn.model import TrafficGNN

def train_model():
    # 1. Setup & Config
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    models_dir = os.path.join(current_dir, "models")
    os.makedirs(models_dir, exist_ok=True)
    
    # 2. Prepare Data
    print("Loading Graph...")
    loader = DataLoader()
    G = loader.load_graph()
    
    print("Generating Synthetic Dataset...")
    processor = TrafficDataProcessor(G)
    # Generate 30 days of data
    full_dataset = processor.generate_synthetic_dataset(days=30, samples_per_day=24)
    
    # Temporal Split: 80% train (first 24 days), 20% test (last 6 days)
    split_idx = int(len(full_dataset) * 0.8)
    train_data = full_dataset[:split_idx]
    test_data = full_dataset[split_idx:]
    
    print(f"Train samples: {len(train_data)}, Test samples: {len(test_data)}")
    
    # 3. Initialize Model
    sample_data = train_data[0]
    node_features_dim = sample_data.x.shape[1]
    edge_features_dim = sample_data.edge_attr.shape[1]
    
    model = TrafficGNN(
        node_in_channels=node_features_dim,
        edge_in_channels=edge_features_dim,
        hidden_channels=64,
        out_channels=1
    ).to(device)
    
    optimizer = optim.Adam(model.parameters(), lr=0.001, weight_decay=5e-4)
    criterion = nn.MSELoss()
    
    # 4. Training Loop
    epochs = 20
    best_loss = float('inf')
    
    print("Starting training...")
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        
        for data in train_data:
            data = data.to(device)
            optimizer.zero_grad()
            
            # Forward
            out = model(data.x, data.edge_index, data.edge_attr)
            
            # Loss
            loss = criterion(out, data.y)
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            
        avg_train_loss = total_loss / len(train_data)
        
        # Validation
        model.eval()
        val_loss = 0
        mae_accum = 0
        
        with torch.no_grad():
            for data in test_data:
                data = data.to(device)
                out = model(data.x, data.edge_index, data.edge_attr)
                loss = criterion(out, data.y)
                val_loss += loss.item()
                mae_accum += torch.abs(out - data.y).mean().item()
        
        avg_val_loss = val_loss / len(test_data)
        avg_mae = mae_accum / len(test_data)
        
        print(f"Epoch {epoch+1}/{epochs} | Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f} | MAE: {avg_mae:.4f}")
        
        # Save Best
        if avg_val_loss < best_loss:
            best_loss = avg_val_loss
            torch.save(model.state_dict(), os.path.join(models_dir, "gnn_best.pth"))

if __name__ == "__main__":
    train_model()
