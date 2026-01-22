# Custom Hooks

Lógica de negocio encapsulada y reutilizable.

## Hooks Principales

*   **`useSimulationController.ts`**: "Cerebro" del frontend.
    *   Gestiona el estado de la simulación.
    *   Coordina llamadas a la API (`simulate_routes`).
    *   Maneja la lógica de re-cálculo cuando el usuario se mueve.
*   **`useTheme.ts`**: Gestión del tema (Claro/Oscuro).
