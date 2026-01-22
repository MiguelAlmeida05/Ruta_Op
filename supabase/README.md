# Supabase Configuration

Configuración de base de datos y migraciones SQL.

## Estructura

*   **`migrations/`**: Scripts SQL para versionado del esquema de base de datos.
    *   **`setup_schema.sql`**: Esquema inicial (Tablas base de usuarios, productos, sesiones).
    *   **`updates/`**: Migraciones incrementales.
        *   `01_add_orders_kpis.sql`: Agrega columnas para métricas financieras.
        *   `02_add_simulation_events.sql`: Crea tabla para loguear eventos de simulación (recalculos por lluvia/tráfico).

## Uso
Estos scripts deben ejecutarse en la consola SQL de Supabase o mediante CLI para mantener la base de datos sincronizada con el código del backend.
