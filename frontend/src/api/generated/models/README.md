# API Models

Modelos de datos (Interfaces TypeScript) sincronizados con los esquemas Pydantic del Backend.

## Modelos Principales

*   **`SimulationRequest`**: Datos necesarios para iniciar una simulación (Ubicación usuario, Producto).
*   **`RouteResult`**: Resultado detallado de una ruta optimizada, incluyendo geometría y métricas financieras.
*   **`SimulationMetrics`**: KPIs agregados de la simulación (Revenue, Profit, Accuracy).
*   **`Seller`**: Información de vendedores (Coordenadas, Inventario).
*   **`Product`**: Catálogo de productos agrícolas.

## Sincronización
Estos archivos se sobrescriben cada vez que se ejecuta `npm run generate-api`. Cualquier cambio manual se perderá.
La fuente de verdad es `backend/app/schemas.py`.
