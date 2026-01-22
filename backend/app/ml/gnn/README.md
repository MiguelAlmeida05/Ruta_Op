# Graph Neural Networks (GNN)

Módulo experimental para predicción de tráfico usando Deep Learning sobre grafos.

## Descripción
Utiliza **PyTorch Geometric** para modelar la red vial de Portoviejo como un grafo donde:
*   **Nodos**: Intersecciones.
*   **Aristas**: Calles (con atributos de longitud y tipo).

## Archivos
*   **`model.py`**: Definición de la arquitectura GNN (ej: GCN, GAT).
*   **`train.py`**: Loop de entrenamiento.
*   **`data_processor.py`**: Convierte el grafo de NetworkX a tensores de PyTorch.
