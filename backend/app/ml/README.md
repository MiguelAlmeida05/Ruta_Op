# Machine Learning Module

Este módulo centraliza todos los modelos predictivos y de inteligencia artificial del sistema.

## Componentes

### 1. Demand Forecasting (`demand_forecasting/`)
Predicción de demanda de productos agrícolas basada en series de tiempo históricas.
*   **Modelo**: Facebook Prophet.
*   **Lógica**: Estacionalidad anual y semanal multiplicativa.
*   **Uso**: Estimar ingresos futuros para los vendedores.

### 2. ETA Prediction (`eta_predictor.py`)
Estimación de Tiempo de Llegada (Estimated Time of Arrival) avanzada.
*   **Modelo**: XGBoost (`eta_xgboost_v1.pkl`).
*   **Features**: Distancia, Clima (mm lluvia), Tráfico (nivel 0-1), Hora del día.
*   **Fallback**: Si el modelo no carga, `FactorSimulator` usa lógica estocástica.

### 3. GNN Traffic Prediction (`gnn/`)
(Experimental) Predicción de congestión basada en la topología de la red vial.
*   **Modelo**: Graph Neural Network (PyTorch Geometric).
*   **Objetivo**: Predecir velocidad media en los arcos del grafo.

## Estructura

*   `models/`: Directorio para artefactos serializados (`.pkl`, `.pth`).
*   `feature_pipeline.py`: Transformación de datos crudos a vectores de características para los modelos.
