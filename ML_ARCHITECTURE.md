# Arquitectura de Predicción de ETA basada en ML

## Resumen
Este documento describe la implementación técnica del sistema de predicción de tiempos de arribo (ETA) basado en Gradient Boosting (XGBoost), diseñado para reemplazar la heurística de distribución triangular anterior.

## Componentes del Sistema

### 1. Estructura de Archivos
```
backend/
├── ml/
│   ├── models/            # Almacenamiento de artefactos serializados (.pkl)
│   ├── eta_predictor.py   # Clase principal de inferencia (ETAPredictor)
│   └── feature_pipeline.py# Transformación de datos (Feature Engineering)
└── simulation_engine.py   # Integración con el motor de simulación existente
```

### 2. Pipeline de Datos (`FeaturePipeline`)
Transforma variables operativas crudas en vectores numéricos para el modelo.

**Inputs:**
- `timestamp`: Fecha/Hora (para extraer hora pico, día semana).
- `distance_km`: Distancia de ruta calculada.
- `base_duration_min`: Tiempo estimado base (velocidad promedio).
- `weather_data`: Intensidad de lluvia (mm).
- `traffic_data`: Nivel de congestión (0.0 - 1.0).

**Features Generados:**
- `hour_of_day`, `day_of_week`, `is_weekend`
- `is_peak_hour` (Heurística: 7-9 AM, 5-7 PM)
- `rain_intensity`, `traffic_level`
- `road_type_primary_ratio`

### 3. Modelo Predictivo (`ETAPredictor`)
- **Algoritmo**: XGBoost Regressor.
- **Objetivo**: Predecir la duración real del viaje en minutos.
- **Persistencia**: Serialización mediante `joblib`.
- **Fallback**: Si el modelo no carga, el sistema revierte automáticamente a la simulación triangular.

### 4. Integración (`SimulationEngine`)
El método `FactorSimulator.simulate_factors` ha sido actualizado para funcionar en modo híbrido:

1.  **Intento de Inferencia ML**: Se consulta el `ETAPredictor`.
2.  **Simulación de Varianza**: Se aplica un ruido gaussiano reducido (+/- 3% std) sobre la predicción del ML para mantener la naturaleza estocástica requerida por el análisis de escenarios "what-if", pero con mucha mayor precisión central que la triangular anterior.
3.  **Fallback**: Si falla el ML, se usa la lógica `random.triangular` antigua.

## Instrucciones de Uso

### Reentrenamiento del Modelo
Se provee un script para generar datos sintéticos y entrenar un nuevo modelo (Prueba de Concepto):

```bash
python scripts/train_eta_model_mock.py
```

Esto generará un nuevo artefacto en `backend/ml/models/eta_xgboost_v1.pkl`.

### Configuración
El sistema carga automáticamente el modelo desde la ruta por defecto. No requiere configuración adicional en `main.py`.

## Próximos Pasos (Fase Piloto)
1.  Conectar APIs reales de Clima (OpenWeatherMap) y Tráfico (Google/Here) en `main.py` para alimentar el `predict()`.
2.  Recolectar datos reales de operaciones para reemplazar el generador sintético.
3.  Implementar monitoreo de Drift (desviación de predicciones vs realidad).
