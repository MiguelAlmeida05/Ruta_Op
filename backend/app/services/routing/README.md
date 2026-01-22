# Routing Service

Implementación de algoritmos de optimización de rutas.

## Archivos
*   **`algorithms.py`**:
    *   `PathFinder`: Clase principal.
    *   **Algoritmos**: Dijkstra y A* (con heurística Haversine).
    *   **Optimizaciones**: Intenta usar `rustworkx` (binding de Rust) para rendimiento crítico, con fallback transparente a `networkx`.
    *   **Penalizaciones Dinámicas**:
        *   `apply_penalties`: Ajusta pesos según eventos (Lluvia, Tráfico, Protestas) y tipo de vía (Primary, Secondary, etc.).
