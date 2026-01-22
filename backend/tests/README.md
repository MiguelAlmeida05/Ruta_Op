# Test Suite

Pruebas automatizadas usando `pytest`.

## Estructura

*   **`test_algorithms.py`**: Pruebas unitarias de Dijkstra y A*.
*   **`test_calculations.py`**: Validación de heurísticas y fórmulas matemáticas.
*   **`test_ml_integration.py`**: Verifica que los modelos de ML carguen y predigan sin errores.
*   **`test_sessions.py`**: Test de concurrencia y aislamiento de sesiones de usuario.
*   **`test_validation_current.py`**: Pruebas de integración del sistema completo.

## Cobertura de Código (.coverage)

El archivo `.coverage` ubicado en la raíz del proyecto (o backend) es un artefacto binario generado por `pytest-cov`.
Contiene estadísticas sobre qué líneas de código fueron ejecutadas durante las pruebas.

Para visualizar el reporte:
```bash
# Generar reporte en terminal
pytest --cov=app

# Generar reporte HTML
pytest --cov=app --cov-report=html
```
Actualmente, las pruebas cubren los flujos críticos:
1.  Cálculo de rutas (Happy path y casos de borde).
2.  Lógica de simulación estocástica.
3.  Integración básica de modelos ML.
