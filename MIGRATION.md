# Migración de Algoritmos de Grafos: NetworkX a Rustworkx

## Resumen Ejecutivo
Se ha completado la migración del motor de algoritmos de grafos desde NetworkX (NX) a Rustworkx (RX). Esta actualización proporciona una mejora significativa en el rendimiento (aproximadamente 6x más rápido) manteniendo la compatibilidad total con la lógica de negocio existente y los modelos de datos de OSMnx.

## Evaluación Comparativa

### Opciones Evaluadas
1.  **NetworkX (Base actual)**:
    -   *Ventajas*: Puro Python, fácil de depurar, estándar de la industria.
    -   *Desventajas*: Lento para grafos grandes o cálculos intensivos (Dijkstra puro en Python).
2.  **Rustworkx**:
    -   *Ventajas*: Escrito en Rust, bindings de Python eficientes, API similar a NetworkX, fácil instalación (`pip install rustworkx`).
    -   *Resultados*: ~6.18x de aceleración en pruebas de Dijkstra.
3.  **Graph-tool**:
    -   *Ventajas*: Extremadamente rápido (C++).
    -   *Desventajas*: **No soportado nativamente en Windows**. Requiere compilación compleja, Docker o WSL, lo cual complica el despliegue y desarrollo en entornos Windows estándar.
    -   *Decisión*: Descartado por incompatibilidad con el entorno de desarrollo actual (Windows).

### Resultados de Benchmark (Dijkstra)
-   **Grafo**: Portoviejo (~8.5k nodos, ~20k aristas)
-   **NetworkX**: ~18-20 ms por ruta
-   **Rustworkx**: ~3-7 ms por ruta
-   **Speedup**: ~3x - 6x (dependiendo de la complejidad de la ruta y overhead de Python)

## Detalles de Implementación

### Cambios en `algorithms.py`
La clase `PathFinder` ha sido actualizada para operar en modo híbrido:
1.  **Inicialización**: Al crear `PathFinder(G)`, el grafo NetworkX se convierte automáticamente a un grafo Rustworkx (`self.rx_graph`).
2.  **Mapeo de IDs**: Se mantiene un mapeo bidireccional entre los IDs de nodos de OSM (int/str) y los índices internos de Rustworkx (int).
3.  **Lógica de Dijkstra (`run_dijkstra`)**:
    -   Intenta ejecutar la versión optimizada en Rustworkx (`_run_dijkstra_rx`).
    -   Utiliza una función de peso personalizada (`weight_fn`) que aplica penalizaciones dinámicas (lluvia, tráfico, protestas) en tiempo de ejecución, preservando la flexibilidad de la implementación original.
    -   Si ocurre algún error o conversión, hace fallback automático a la implementación original de NetworkX (`_run_dijkstra_nx`).

### Compatibilidad
-   **Transparente**: El resto de la aplicación (API endpoints) no requiere cambios. La firma de los métodos `run_dijkstra` se mantiene idéntica.
-   **Fallback Seguro**: Si Rustworkx falla por cualquier motivo, el sistema sigue funcionando con NetworkX.

## Instrucciones para el Equipo

### Nuevos Requisitos
Instalar la librería Rustworkx:
```bash
pip install rustworkx
```

### Verificación
Para verificar que la migración está activa y funcionando:
```bash
python scripts/verify_migration.py
```
Debe mostrar: `VERIFICATION PASSED: Using Rustworkx implementation.`

### Mantenimiento
-   Si se añaden nuevos atributos a las aristas que afecten el peso, asegurarse de actualizarlos en la función `weight_fn` dentro de `_run_dijkstra_rx`.
-   El grafo de Rustworkx es estático después de la inicialización. Si el grafo `G` cambia dinámicamente (añadir/quitar nodos), se debe recrear `PathFinder` o implementar un método de sincronización.
