# TuDestri (Ruta_Op)

## Visión General
**TuDestri** es una plataforma integral de optimización logística diseñada para la distribución de productos agrícolas en Portoviejo, Ecuador. El sistema combina algoritmos de ruteo avanzados, simulación estocástica y machine learning para ofrecer rutas eficientes, predicción de tiempos de entrega (ETA) y análisis de demanda.

## Arquitectura del Sistema

El proyecto sigue una arquitectura **Monorepo** que integra dos componentes principales:

1.  **Backend (Python / FastAPI)**:
    *   **Motor de Inteligencia**: Ejecuta algoritmos de grafos (Dijkstra, A*), simulaciones de Monte Carlo y modelos de predicción.
    *   **API REST**: Expone endpoints para el cálculo de rutas, gestión de sesiones de simulación y recuperación de datos.
    *   **Ciencia de Datos**: Integra bibliotecas como `networkx`, `osmnx`, `prophet` y `xgboost`.

2.  **Frontend (React / TypeScript)**:
    *   **Interfaz de Usuario**: SPA (Single Page Application) moderna construida con Vite.
    *   **Visualización**: Mapas interactivos con Leaflet y gráficos estadísticos.
    *   **Consumo de API**: Cliente HTTP generado automáticamente basado en OpenAPI.

## Flujo de Datos

```mermaid
graph TD
    User[Usuario / Transportista] -->|Solicita Ruta| FE[Frontend React]
    FE -->|JSON Request| BE[Backend FastAPI]
    BE -->|Consulta| DB[(Supabase / Data)]
    BE -->|Carga| G[Grafo Vial (NetworkX)]
    BE -->|Ejecuta| ML[Modelos ML & Simulación]
    ML -->|Resultados| BE
    BE -->|Ruta Optimizada + KPIs| FE
    FE -->|Visualización| User
```

## Carpetas Externas

*   **`data/`**: Contiene los datasets crudos y procesados, incluyendo los grafos de red vial (`.graphml`) y datos estáticos de productos/vendedores.
*   **`supabase/`**: Almacena las migraciones SQL y scripts de configuración para la base de datos Supabase, utilizada para persistencia de usuarios y métricas históricas.

## Estado del Proyecto (Health Check)

A fecha de hoy, el análisis del código indica:

*   ✅ **Lógica de Ruteo**: Algoritmos de Dijkstra y A* implementados correctamente con penalizaciones dinámicas (Lluvia, Tráfico).
*   ✅ **Simulación**: Motor de Cadenas de Markov y Monte Carlo matemáticamente consistente.
*   ✅ **Conexión API**: Los modelos de Pydantic en el backend están sincronizados con los tipos de TypeScript en el frontend.
*   ⚠️ **Issue Detectado**: En `backend/Dockerfile`, el comando de inicio apunta a `api.main:app`, pero la estructura de carpetas sugiere `app.main:app`. Esto podría causar fallos en el despliegue de contenedores.
