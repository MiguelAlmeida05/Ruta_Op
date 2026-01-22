# Simulation Service

Motor estocástico para modelar incertidumbre logística.

## Archivos
*   **`engine.py`**:
    *   `MarkovChain`: Modela la evolución del estado del sistema (Normal -> Lluvia -> Tráfico).
    *   `SimulationSessionManager`: Mantiene el estado de simulación por usuario/sesión.
    *   `FactorSimulator`: Aplica variabilidad a tiempos y consumo usando distribuciones estadísticas (Triangular, Normal) o modelos ML.
    *   `KPICalculator`: Calcula métricas de negocio (Puntualidad, Frescura, Satisfacción).
