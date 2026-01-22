# Data Storage

Este directorio almacena los activos de datos estáticos y pre-procesados del sistema.

## Estructura

*   **`processed/`**: Datos listos para ser consumidos por la aplicación.
    *   **`portoviejo_graph.graphml`**: Grafo de la red vial de Portoviejo.
        *   **Nodos**: Intersecciones.
        *   **Aristas**: Calles con atributos de velocidad, longitud y tiempo de viaje pre-calculado.
        *   Generado por: `backend/app/services/graph/loader.py` usando `osmnx`.

*   **`raw/`** (Opcional): Descargas crudas temporales si fuera necesario.

## Notas
Este directorio se monta como volumen en los contenedores Docker para persistencia de datos geográficos pesados, evitando re-descargas innecesarias.
