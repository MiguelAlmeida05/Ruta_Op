# Core Module

Módulo de infraestructura y configuración transversal.

## Contenido

*   **`config.py`**: Gestión de variables de entorno usando `pydantic-settings`.
    *   Carga `.env`.
    *   Define constantes como `SUPABASE_URL`, `LOG_LEVEL` y orígenes CORS.
*   **`database.py`**: Cliente Singleton para conexión con Supabase.
*   **`logger.py`**: Configuración de logging estructurado (JSON) para observabilidad en producción.
*   **`middleware.py`**: Middleware HTTP para interceptar requests.
    *   Genera `request_id` único.
    *   Mide tiempos de ejecución.
    *   Loguea entrada/salida de peticiones.
*   **`repository.py`**: Patrón Repositorio para abstracción de datos.
    *   Maneja la lógica de acceso a datos estáticos (productos, vendedores) y dinámicos (eventos de simulación en Supabase).
