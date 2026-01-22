# Reporte de Mejoras y Bugs del Frontend

## 1. Gestión de Estado Global (Code Smell / Bug Potencial)
**Archivo:** `src/pages/Home.tsx`
**Problema:** El componente `Home` maneja demasiado estado local (`userLocation`, `sellers`, `routes`, `role`, `simulationProgress`, etc.). Esto provoca "prop drilling" hacia `DarkMap`, `MetricsDashboard` y `ProductSimulator`.
**Recomendación:** Utilizar **Zustand** (ya instalado en dependencias) para crear un store global (`useStore`) que maneje el estado de la sesión, la simulación y la configuración del usuario.

## 2. Lógica de Negocio en Componentes UI
**Archivo:** `src/components/DarkMap.tsx`
**Problema:** Contiene lógica compleja de simulación (`useEffect` con `setInterval`, manejo de eventos estocásticos, recálculo de rutas). Esto viola el principio de responsabilidad única.
**Recomendación:** Extraer esta lógica a un custom hook `useSimulationController.ts` o moverla a un servicio.

**Archivo:** `src/components/MetricsDashboard.tsx`
**Problema:** Duplicación de lógica de cálculo de KPIs (`calculateLocalMetrics`). El frontend recalcula costos y beneficios que el backend ya debería haber provisto o validado.
**Riesgo:** Inconsistencia entre lo que ve el usuario y lo que registra el backend.

## 3. URLs Hardcodeadas y Assets
**Archivo:** `src/components/MetricsDashboard.tsx`
**Problema:** Uso de `https://placehold.co/200x200...` para imágenes fallidas.
**Recomendación:** Usar un asset local por defecto en `public/assets/`.

**Archivo:** `src/components/DarkMap.tsx`
**Problema:** Iconos definidos con strings HTML/SVG dentro del código TypeScript.
**Recomendación:** Crear componentes React para los iconos o usar archivos SVG importados.

## 4. Tipado
**Archivo:** `src/types.ts` (Inferido)
**Observación:** Verificar que las interfaces coincidan exactamente con las respuestas de la nueva API refactorizada (`backend/app/main.py`), especialmente `metrics` y `routes`.

## 5. Rendimiento
**Observación:** El mapa hace re-renderizados frecuentes durante la simulación debido a la actualización de `vehiclePos` y `simulationProgress`.
**Recomendación:** Usar `useRef` para actualizaciones de posición imperativas en Leaflet o optimizar los selectores de estado si se migra a Zustand.
