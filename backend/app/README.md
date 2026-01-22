# App Module

Este directorio contiene el código fuente principal de la aplicación FastAPI.

## Archivos Principales

*   **`main.py`**: Punto de entrada de la aplicación.
    *   Inicializa `FastAPI`.
    *   Configura el middleware `RequestMiddleware`.
    *   Carga el grafo vial en el evento `startup`.
    *   Define los endpoints REST (`/api/routes/*`, `/api/products`, etc.).
    *   Maneja excepciones globales y específicas (`GeoLocationError`).

*   **`schemas.py`**: Modelos Pydantic (Data Transfer Objects).
    *   Define la estructura estricta de entrada y salida de la API.
    *   Sincronizado con los modelos TypeScript del frontend.
    *   Clases clave: `SimulationRequest`, `RouteResult`, `Seller`, `SimulationMetrics`.

*   **`exceptions.py`**: Definiciones de errores personalizados.
    *   `GeoLocationError`: Se lanza cuando fallan las operaciones de `osmnx` (ej: coordenadas fuera del grafo).

## Submódulos

*   **`core/`**: Configuración base, base de datos y utilidades transversales (Logging).
*   **`ml/`**: Modelos de Inteligencia Artificial (Predicción y Demanda).
*   **`services/`**: Lógica de negocio pura (Grafos, Ruteo, Simulación).
