# Graph Service

Maneja la carga y persistencia de la red vial.

## Archivos
*   **`loader.py`**: Clase `DataLoader`.
    *   Carga grafos desde archivos `.graphml` en `data/processed`.
    *   Si no existe el archivo, descarga automáticamente el mapa de Portoviejo usando `osmnx`.
    *   Enriquece el grafo con velocidades y tiempos de viaje (`add_edge_speeds`, `add_edge_travel_times`).
