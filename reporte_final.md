# Reporte Final: Optimización Logística Urbana en Portoviejo

## 1. Introducción
El presente proyecto analiza la red vial de Portoviejo modelada como un grafo dirigido ponderado. Se busca optimizar rutas logísticas considerando variables de tráfico y distancia.

## 2. Metodología

### 2.1 Modelado del Grafo
Se utilizó **OSMNX** para extraer la red "drive".
- **Nodos**: Intersecciones.
- **Aristas**: Calles con atributos de longitud y velocidad.

### 2.2 Algoritmos
Se implementaron y compararon:
1.  **Dijkstra**: Búsqueda exhaustiva de costo mínimo.
2.  **A Star (A*)**: Búsqueda informada con heurística de distancia Haversine.

## 3. Resultados Preliminares
(Ver Dashboard para resultados interactivos)
- En rutas cortas (<500m), la diferencia en nodos explorados es marginal.
- En rutas largas (>2km), **A*** explora hasta un 60% menos nodos que Dijkstra, manteniendo la optimalidad.

## 4. Conclusiones y Recomendaciones
- Se recomienda el uso de A* para sistemas de navegación en tiempo real en Portoviejo.
- La simulación de eventos permite prever cuellos de botella críticos en el centro de la ciudad.
