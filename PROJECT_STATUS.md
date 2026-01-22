# Estado del Proyecto y Reporte de Reorganización

## 1. Estructura del Proyecto

La estructura actual sigue una arquitectura monorepo clara:

```
Ruta_Op/
├── backend/                # API FastAPI y Motor de Inteligencia
│   ├── app/
│   │   ├── api/            # Modelos Pydantic y Endpoints
│   │   ├── core/           # Configuración y DB (Supabase)
│   │   ├── services/       # Lógica de Negocio
│   │   │   ├── graph/      # Carga y gestión de grafos (OSMnx)
│   │   │   ├── routing/    # Algoritmos (Dijkstra, A*)
│   │   │   ├── simulation/ # Motor estocástico (Markov, Monte Carlo)
│   │   │   └── validation/ # Servicios de QA y validación estadística
│   │   ├── ml/             # Machine Learning (XGBoost, Prophet)
│   │   └── main.py         # Punto de entrada
│   └── requirements.txt    # Dependencias
│
├── frontend/               # SPA React + Vite
│   ├── src/
│   │   ├── components/     # Componentes UI (Map, Dashboard)
│   │   ├── hooks/          # Lógica de estado (useSimulationController)
│   │   ├── services/       # Cliente HTTP (Axios)
│   │   ├── utils/          # Utilidades (formatters.ts)
│   │   └── pages/          # Vistas principales
│   └── package.json
```

## 2. Verificación de Funcionalidad

### Sincronización de Tiempos
- **Estado Anterior:** Discrepancia visual entre lista de rutas (decimal) y dashboard (MM:SS).
- **Corrección:** Se implementó `src/utils/formatters.ts` con `formatDuration`.
- **Estado Actual:** Ambos componentes usan la misma función de formateo, garantizando consistencia visual (ej. "03:57").

### Velocidad y Realismo
- **Problema:** Rutas cruzando la ciudad en ~5 min (74 km/h promedio).
- **Corrección:** 
    - Se redujo la velocidad máxima en `algorithms.py` de 25 m/s (90 km/h) a 15 m/s (54 km/h).
    - Se ajustó la calibración en `engine.py` para ser más conservadora (tráfico urbano).
- **Resultado Esperado:** Tiempos de viaje más realistas (ej. 15-20 min para cruzar la ciudad).

### Bug de "Congelamiento" (Freeze)
- **Causa:** El evento de recálculo se disparaba en bucle infinito al permanecer en el mismo `step` de la simulación.
- **Corrección:** Se limpia `eventConfigRef.current = null` inmediatamente después de disparar el evento para evitar re-trigger.
- **Robustez:** Se añadió validación para no actualizar la ruta si la geometría devuelta es vacía.

## 3. Mapeo Backend-Frontend

| Backend (Python/FastAPI) | Frontend (React/TS) | Frecuencia Actualización |
|--------------------------|---------------------|--------------------------|
| `RouteResult.duration_min` | `ProductSimulator` (Lista) | Al simular (On Demand) |
| `RouteResult.duration_min` | `MetricsDashboard` (Timer) | Al simular + Interpolación local |
| `SimulationState` | `DarkMap` (Alertas) | Tiempo real (durante simulación) |
| `recalculate_route` | `useSimulationController` | Evento estocástico (Tráfico/Protesta) |

## 4. Recomendaciones Futuras

1. **Persistencia de Calibración:** Guardar los factores de ajuste de velocidad en base de datos para ajustarlos sin redeploy.
2. **Validación E2E:** Implementar tests de Playwright que verifiquen específicamente que el camión llega al destino final.
3. **Logs Estructurados:** Implementar ELK o similar para trazar la latencia de `run_dijkstra` en producción.

---
*Generado automáticamente por Asistente de Desarrollo - 2026-01-22*
