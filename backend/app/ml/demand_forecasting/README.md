# Demand Forecasting

Submódulo encargado de entrenar e inferir la demanda futura de productos.

## Archivos

*   **`forecaster.py`**: Clase `DemandForecaster`.
    *   Encapsula la lógica de `Prophet`.
    *   Métodos: `train()`, `predict()`, `save()`, `load()`.
    *   Maneja la persistencia de modelos en `models/prophet_{producto}.pkl`.
*   **`train_demand.py`**: Script para entrenar modelos desde cero usando datos históricos (CSV/DB).
*   **`data_generator.py`**: Utilidad para crear datasets sintéticos de ventas para pruebas.

## Modelos Soportados
Actualmente se tienen modelos pre-entrenados para:
*   Arroz
*   Cacao
