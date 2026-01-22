import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv

class TrafficGNN(torch.nn.Module):
    def __init__(self, node_in_channels, edge_in_channels, hidden_channels=64, out_channels=1, num_layers=3):
        super(TrafficGNN, self).__init__()
        
        self.num_layers = num_layers
        
        # 1. Node Embedding (GraphSAGE)
        self.convs = torch.nn.ModuleList()
        self.convs.append(SAGEConv(node_in_channels, hidden_channels, aggr='mean'))
        
        for _ in range(num_layers - 2):
            self.convs.append(SAGEConv(hidden_channels, hidden_channels, aggr='mean'))
            
        self.convs.append(SAGEConv(hidden_channels, hidden_channels, aggr='mean'))
        
        # 2. Edge Predictor (MLP)
        predictor_input_dim = (hidden_channels * 2) + edge_in_channels
        
        self.predictor = nn.Sequential(
            nn.Linear(predictor_input_dim, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, out_channels),
            nn.Sigmoid() 
        )

    def forward(self, x, edge_index, edge_attr):
        h = x
        for i, conv in enumerate(self.convs):
            h = conv(h, edge_index)
            if i < self.num_layers - 1:
                h = F.relu(h)
                h = F.dropout(h, p=0.3, training=self.training)
        
        row, col = edge_index
        u_emb = h[row]
        v_emb = h[col]
        
        edge_repr = torch.cat([u_emb, v_emb, edge_attr], dim=1)
        out = self.predictor(edge_repr)
        
        return out
