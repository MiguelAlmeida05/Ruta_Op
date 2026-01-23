# TuDistri (Ruta_Op)

Plataforma de apoyo para logística de distribución: ruteo sobre una red vial real, simulación de eventos (clima/tráfico/bloqueos) y evaluación de modelos predictivos (ETA, impacto, demanda). Este README es el punto de entrada principal para entender el proyecto, ejecutarlo localmente y ubicar su documentación técnica.

**Estado del stack**
- **Frontend:** React + TypeScript + Vite + TailwindCSS + Recharts + Zustand
- **Backend:** FastAPI (Python) + Uvicorn + SQLite local + Rustworkx + XGBoost + Prophet
- **Grafo vial:** GraphML cargado en memoria en el arranque del backend

**Enlaces rápidos**
- Guía práctica paso a paso: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- Documentación integral (contenido completo migrado y enriquecido): ver sección “Documentación integral (migrada)”
- Panel de validación: `Frontend → /validation` (según rutas del router)
- API (local): `http://127.0.0.1:8000` (Swagger/OpenAPI en `/docs`)

---

## Tabla de contenidos

- [1. ¿Qué es este proyecto?](#1-qué-es-este-proyecto)
- [2. Funcionalidades principales](#2-funcionalidades-principales)
- [3. Arquitectura general](#3-arquitectura-general)
- [4. Datos y simulación](#4-datos-y-simulación)
- [5. Modelos y métricas](#5-modelos-y-métricas)
- [6. Validación y calidad](#6-validación-y-calidad)
- [7. Estructura del repositorio](#7-estructura-del-repositorio)
- [8. API (resumen)](#8-api-resumen)
- [9. Operación local: qué debería ver “si todo está bien”](#9-operación-local-qué-debería-ver-si-todo-está-bien)
- [10. Convenciones y criterios de contribución](#10-convenciones-y-criterios-de-contribución)
- [11. Documentación integral (migrada)](#11-documentación-integral-migrada)

---

## 1. ¿Qué es este proyecto?

TuDistri es una plataforma que asiste en la logística de distribución, con tres ideas centrales:

1) **Ruteo realista:** rutas sobre un grafo vial real (nodos/aristas con tiempos de viaje).  
2) **Simulación:** incorpora variabilidad del mundo real (lluvia, tráfico, bloqueos) para evaluar robustez y riesgos.  
3) **Modelos ML evaluables:** no sólo “predecir”, sino medir calidad, generalización y consistencia mediante métricas claras.

El resultado es una aplicación con:
- una **pantalla principal** de mapa y simulación;  
- un **dashboard de validación** que actúa como QA funcional y ML;  
- endpoints de API para productos, vendedores, rutas, simulación y evaluación.

---

## 2. Funcionalidades principales

### 2.1 Ruteo (Dijkstra vs A*)

- Calcula rutas mínimas por costo (tiempo de viaje) en un grafo dirigido con multiaristas.
- Aplica penalizaciones por evento (ej. lluvia/tráfico/protesta) para alterar costos.
- Compara Dijkstra (óptimo por costo) vs A* (óptimo si la heurística es admisible).
- Genera métricas y series para validación: tiempos, speedup y discrepancias.

### 2.2 Simulación (Monte Carlo)

- Ejecuta múltiples realizaciones para estimar distribución de duración/resultado, no un único número.
- Reporta estabilidad con CV% e IC 95%.
- Produce series y distribuciones para visualización.

### 2.3 Modelos predictivos

- **ETA (XGBoost):** predice duración (minutos) y reporta MAE/RMSE/R²; además genera una clasificación derivada Late/OnTime para ROC/AUC y matriz de confusión.
- **Impacto (XGBoost):** predice múltiples impactos y evalúa generalización (train/test y CV).
- **Demanda (Prophet):** forecast por producto y métricas robustas (sMAPE/wMAPE, etc.).

### 2.4 Dashboard de validación

- Consolida calidad del sistema: conectividad API, consistencia de algoritmos, estabilidad de simulación y desempeño de modelos.
- Muestra “Sin datos” y errores accionables cuando la API no responde o el formato es inválido.
- Incluye fórmulas como texto y permite copiar expresiones (UX).

---

## 3. Arquitectura general

### 3.1 Componentes

- **Frontend (SPA):**
  - Interfaz de usuario, mapas, visualización y experiencia de simulación.
  - Consume la API y renderiza métricas/series.
- **Backend (API):**
  - Carga grafo, corre algoritmos, simula escenarios, evalúa modelos y responde JSON.
  - Persiste datos locales (SQLite) para catálogo y órdenes sintéticas.
- **Datos local + grafo:**
  - SQLite para “estado de demo”.
  - GraphML para el grafo vial (cargado en memoria).

### 3.2 Interacción (flujo)

1) El frontend solicita productos y vendedores.
2) El usuario elige escenario/producto y se calculan rutas.
3) Se ejecuta simulación; bajo eventos se recalcula ruta.
4) En paralelo, el dashboard consulta endpoints de validación/modelos.
5) El frontend valida el shape de respuestas y muestra UI coherente o errores accionables.

---

## 4. Datos y simulación

### 4.1 Datos persistidos (modo local)

En modo local se usa SQLite para:
- catálogo de productos (incluye `image_url`);
- vendedores con coordenadas;
- órdenes históricas sintéticas (para demanda);
- eventos de simulación (auditoría de sesiones).

### 4.2 Serie de demanda sintética (intuición)

La serie diaria por producto combina:
- una base por producto;
- estacionalidad anual;
- patrón semanal;
- ruido controlado.

Esto permite:
- entrenar/evaluar Prophet de manera reproducible;
- evitar dependencias de fuentes externas durante desarrollo.

---

## 5. Modelos y métricas

### 5.1 Métricas: principios de interpretación

- **MAE/RMSE:** “errores en unidades del target” (minutos o kg).  
- **R²:** cuánto de la variabilidad explica el modelo; no siempre alto si el fenómeno es ruidoso.  
- **MAPE:** útil pero se rompe cuando el valor real es muy pequeño; por eso se usa **sMAPE** y **wMAPE**.  
- **ROC/AUC:** mide si la clasificación separa clases mejor que el azar (AUC≈0.5 es pobre).

### 5.2 Validación de datos (cliente)

Para mantener robustez:
- el frontend valida shapes de respuestas críticas (ej. `/api/validation/stats`);
- si la respuesta no cumple el contrato esperado, se detiene el render “vacío” y se muestra una alerta con causas.

### 5.3 Validación de datos (servidor)

El backend valida requests con Pydantic:
- rangos (lat/lng, progress 0..1, weight > 0);
- valores permitidos (product_id, event_type, mode);
- mensajes 422 accionables con detalle de campos.

---

## 6. Validación y calidad

### 6.1 ¿Qué valida el dashboard?

- Conectividad del sistema (que los endpoints respondan).
- Consistencia de rutas (Dijkstra vs A*).
- Estabilidad de simulación (CV%, IC, distribución).
- Desempeño y generalización de modelos (R², errores, CV).

### 6.2 Señales comunes de problemas

- **Gráficos vacíos:** API no respondió, shape inválido o arrays vacíos.
- **CV≈0 e IC≈0:** simulación degenerada (muy determinista) o datos mal calculados.
- **R² perfecto irreal:** datos sintéticos “demasiado limpios” o fuga de información.
- **MAPE enorme:** división por valores reales muy pequeños (usar sMAPE/wMAPE).

---

## 7. Estructura del repositorio

Vista rápida (ampliada y explicada):

- `backend/app/`
  - `main.py`: API, inicialización, endpoints y carga de grafo.
  - `schemas.py`: modelos de request/response y validación de entrada.
  - `core/`: configuración, logger, middleware, repositorio y DB local.
  - `services/`:
    - `graph/`: carga del grafo (GraphML).
    - `routing/`: Dijkstra/A* y utilidades.
    - `simulation/`: motor estocástico y KPIs.
    - `validation/`: métricas de validación y series para el dashboard.
  - `ml/`:
    - `eta_predictor.py`, `impact_predictor.py`
    - `demand_forecasting/`: Prophet, data generator y entrenamiento.
- `frontend/src/`
  - `pages/`: pantallas (Home, ValidationDashboard).
  - `components/`: mapa, dashboard de métricas, componentes UI.
  - `hooks/`: controlador de simulación y tema.
  - `services/`: cliente API (con fallback y validación de respuesta).
  - `validation/`: validación de shapes (runtime) para respuestas críticas.
  - `store/`: Zustand (estado global).

---

## 8. API (resumen)

Base: `/api`

- Productos
  - `GET /api/products`
- Vendedores
  - `GET /api/sellers?product_id=<id>`
- Rutas
  - `POST /api/routes`
  - `POST /api/routes/recalculate`
- Simulación
  - `POST /api/simulate`
- Validación
  - `GET /api/validation/stats`
- Modelos
  - `GET /api/models/eta/evaluate`
  - `POST /api/models/eta/train_mock`
  - `GET /api/models/impact/evaluate`
  - `GET /api/models/demand/evaluate_fast?product=<id>`

Para detalles reproducibles de instalación y ejecución: [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

## 9. Operación local: qué debería ver “si todo está bien”

Al ejecutar frontend y backend:
- Backend levanta sin errores y loguea la carga del grafo (“Graph loaded successfully with … nodes”).
- `/api/validation/stats` devuelve `routing.samples > 0` y `simulation.durations_sample` no vacío.
- En el dashboard:
  - “Ruteo”: muestra matches y series.
  - “Monte Carlo”: muestra series y CV%.
  - Si un endpoint falla, aparece una alerta con mensaje accionable (no un gráfico vacío).

---

## 10. Convenciones y criterios de contribución

### 10.1 Principios

- Preferir código legible y modular (reglas de validación y parsing centralizadas).
- Evitar “render silencioso” cuando el backend devuelve datos inválidos; mostrar errores claros.
- Mantener consistencia visual del tema (tooltips, placeholders, estados).

### 10.2 Calidad

- Antes de subir cambios:
  - `backend`: ejecutar `pytest`.
  - `frontend`: ejecutar `npm run lint` y `npm test`.

---

## 11. Documentación integral (migrada)

Esta sección contiene **todo el contenido original** del archivo `DOCUMENTACION_TuDistri.md` (sin omisiones) y sirve como referencia completa. El README añade estructura superior, guías y contexto adicional sin perder información.

<details>
<summary><strong>Ver documentación integral completa (contenido original)</strong></summary>

# TuDistri / Ruta_Op — Documentación Integral del Proyecto

Versión del documento: 1.0  
Última actualización: 2026-01-23  
Audiencia: desarrollo, producto, operaciones, QA, stakeholders no técnicos  

---

## 0) Cómo leer este documento

- Este documento está pensado como “fuente única de verdad” del proyecto.
- Está organizado desde una vista general (qué es el producto) hacia detalles (cómo funciona por dentro).
- Cuando aparezcan fórmulas, se muestran como texto en notación matemática estándar.
- Cuando se mencionen archivos, se referencian como rutas relativas dentro del repositorio.
- La documentación evita jerga innecesaria, pero mantiene precisión técnica.

---

## 1) Introducción y Objetivos

### 1.1 ¿Qué es TuDistri?

- TuDistri es una plataforma que asiste en la logística de distribución (ruteo, simulación de entregas, y análisis de desempeño).
- La aplicación permite:
- Seleccionar productos y vendedores.
- Calcular rutas óptimas en una red vial (grafo).
- Simular eventos del mundo real (lluvia, tráfico, bloqueos/paro) y su efecto en tiempo, eficiencia y métricas.
- Evaluar modelos predictivos:
- ETA (Estimated Time of Arrival) con XGBoost.
- Impacto operacional/ambiental con XGBoost.
- Demanda por producto con Prophet.
- Visualizar resultados de validación y consistencia del sistema en un dashboard.

### 1.2 Problemas que resuelve

- Planeación de rutas y tiempos de entrega en condiciones variables.
- Comparación cuantitativa entre algoritmos de ruteo.
- Detección de inestabilidad en simulaciones (robustez).
- Medición de calidad de modelos predictivos (no sólo “que corra”, sino qué tan bien predice).
- Transparencia: “por qué” una ruta o una métrica se ve de cierta manera.

### 1.3 Objetivo principal (Core)

- Reducir incertidumbre y mejorar decisiones de distribución mediante:
- Rutas calculadas en una red realista.
- Simulación de escenarios (riesgo operacional).
- Predicciones y métricas interpretables.

### 1.4 Objetivos a corto plazo

- Mantener la plataforma estable y fácil de ejecutar localmente.
- Asegurar que el dashboard de validación muestre datos correctos y útiles.
- Mejorar consistencia entre ruteo Dijkstra y A* bajo eventos.
- Asegurar que la simulación muestre variabilidad realista, no series planas.

### 1.5 Objetivos a mediano plazo

- Conectar fuentes reales de demanda/órdenes (más allá de la semilla local).
- Calibrar penalizaciones y probabilidades de eventos con datos históricos.
- Mejorar interpretabilidad de métricas en el panel de administración.

### 1.6 Objetivos a largo plazo

- Integrar predicciones con decisiones automáticas (recomendación de rutas, horarios y asignación).
- Introducir aprendizaje continuo (re-entrenos controlados y monitoreo de deriva).
- Operar en entornos de producción con monitoreo y observabilidad robusta.

---

## 2) Arquitectura General

### 2.1 Componentes principales

- Frontend (SPA):
- Tecnologías: React + TypeScript + Vite.
- UI: TailwindCSS.
- Visualización: Recharts.
- Estado: Zustand.
- Backend (API):
- Tecnologías: FastAPI (Python).
- Modelos: XGBoost, Prophet.
- Algoritmos: Dijkstra y A* sobre un grafo vial.
- Validación: endpoints que devuelven métricas y series para el dashboard.
- Base de datos local (persistencia simple):
- SQLite (modo local, sin servicios externos).
- Seed de catálogo, vendedores y órdenes históricas sintéticas.

### 2.2 Flujo de datos (alto nivel)

- El frontend solicita al backend:
- Catálogo de productos.
- Lista de vendedores filtrados por producto.
- Rutas y geometrías (polilíneas).
- Simulaciones (resultado por ruta, eventos y métricas).
- Evaluaciones de modelos (ETA, Impacto, Demanda).
- Estadísticas de validación (ruteo y Monte Carlo).

### 2.3 Justificación de decisiones técnicas

- FastAPI:
- Permite construir APIs rápidas con tipado y validación.
- Integra bien con Pydantic para esquemas de request/response.
- SQLite local:
- Reduce fricción de ejecución (no requiere levantar un motor externo).
- Adecuado para prototipado, demos y desarrollo local.
- GraphML para el grafo:
- Permite almacenar un grafo grande procesado previamente.
- Se carga en memoria al iniciar el backend para consultas rápidas.
- Rustworkx:
- Ofrece algoritmos de grafos con alto rendimiento en Python.
- Dijkstra y A* se ejecutan sobre estructuras optimizadas.
- Recharts:
- Facilita gráficos rápidos y estilizados con React.
- Útil para dashboards de validación con series, histogramas y comparativas.

---

## 3) Repositorio — Estructura de Carpetas

### 3.1 Estructura general (resumen)

- backend/
- app/
- core/ (configuración, DB local, repositorio, middleware)
- services/ (grafo, ruteo, simulación, validación)
- ml/ (modelos predictivos, entrenamiento y utilidades)
- main.py (API)
- schemas.py (esquemas de respuesta/solicitud)
- data/ (SQLite local)
- tests/ (pytest)
- frontend/
- src/
- pages/ (pantallas principales)
- components/ (mapa, métricas, UI)
- hooks/ (controlador de simulación, tema)
- store/ (Zustand)
- services/ (cliente API)
- types/ (tipos auxiliares para validaciones)
- api/generated/ (cliente OpenAPI autogenerado)
- public/ (assets estáticos)
- DOCUMENTACION_TuDistri.md (este documento)

---

## 4) Documentación del Backend

### 4.1 Backend — Tecnología y ejecución

- Lenguaje: Python.
- Framework: FastAPI.
- Servidor ASGI recomendado: Uvicorn.
- Directorio principal: backend/app.

### 4.2 Backend — Configuración (app/core/config.py)

- Se usa una clase Settings (Pydantic Settings) para centralizar:
- PROJECT_NAME, VERSION, API_V1_STR.
- BACKEND_CORS_ORIGINS.
- LOCAL_DB_FILENAME.
- LOG_LEVEL, ENABLE_METRICS.
- Variables de entorno:
- Se pueden cargar desde un archivo `.env` (si existe).
- La configuración es “case sensitive”.

### 4.3 Backend — Persistencia local (SQLite)

#### 4.3.1 Ubicación de la base local

- Archivo: backend/app/data/tudistri.sqlite3.
- Creación automática si no existe.
- Se usa WAL (Write-Ahead Logging) para robustez y concurrencia básica.

#### 4.3.2 Esquema de tablas (app/core/localdb.py)

- Tabla products:
- id (PK, TEXT)
- name (TEXT)
- icon (TEXT)
- image_url (TEXT)
- price_per_unit (REAL)
- unit (TEXT)
- Tabla sellers:
- id (PK, TEXT)
- name (TEXT)
- products_json (TEXT) lista de IDs de producto
- lat, lng (REAL)
- rating (REAL)
- trips_count (INTEGER)
- seller_type (TEXT)
- Tabla orders:
- id (PK autoincremental)
- created_at (TEXT, ISO)
- product_id (FK → products.id)
- weight_kg (REAL)
- Índice idx_orders_product_created_at(product_id, created_at)
- Tabla simulation_events:
- id (PK autoincremental)
- created_at (TEXT, ISO)
- event_type (TEXT)
- payload_json (TEXT)

#### 4.3.3 Flujos de lectura/escritura

- Lecturas:
- fetch_products()
- fetch_product_by_id()
- fetch_sellers(product_id opcional)
- Escrituras:
- seed_if_empty() para inicializar catálogo/vendedores/órdenes.
- log_simulation_event() para registrar eventos de simulación.

### 4.4 Backend — Semillas y simulación de datos

#### 4.4.1 Productos (catálogo)

- Fuente: app/core/repository.py define MOCK_PRODUCTS.
- Se insertan en SQLite si la tabla está vacía.
- Se asegura que image_url esté poblado (fallback `/assets/products/<id>.jpg`).

#### 4.4.2 Vendedores

- Fuente: app/core/repository.py define MOCK_SELLERS (datos de demo).
- Cada vendedor tiene:
- id, name, rating, trips_count, type.
- coordinates (lat/lng).
- lista de productos.

#### 4.4.3 Órdenes históricas sintéticas (Demanda)

- Generación: app/core/localdb.py _seed_orders().
- Se crea una serie diaria de 366 días por producto.
- Variables y supuestos:
- d: fecha del día.
- base: demanda base por producto (kg/día).
- seasonal: factor estacional anual.
- weekly: factor por día de la semana.
- noise: factor de ruido aleatorio acotado.
- Fórmulas (conceptuales):
- week = (día_del_año / 365) * 2π
- seasonal = 1 + 0.18 * (0.5 * (1 + sin(week)))
- weekly = 1 + ajuste(weekday)
- noise = clamp(1 + U(-0.12, 0.12), 0.6, 1.4)
- kg = max(1, base * seasonal * weekly * noise)

### 4.5 Backend — Carga del grafo vial

#### 4.5.1 Archivo del grafo

- El grafo se carga desde:
- data/processed/portoviejo_graph.graphml (en el repositorio).
- La carga ocurre al iniciar la aplicación (startup event).

#### 4.5.2 Estructura del grafo

- Representación: MultiDiGraph (NetworkX) compatible con OSM.
- Nodos:
- Identificados por OSM ID (entero).
- Atributos típicos:
- y (latitud)
- x (longitud)
- Aristas:
- Pueden existir múltiples aristas entre dos nodos (multiedges).
- Atributos:
- length_m (longitud en metros)
- travel_time (tiempo de viaje base en segundos)
- highway (tipo de vía: primary, secondary, residential, etc.)

### 4.6 Backend — Ruteo (Dijkstra y A*)

Ubicación: app/services/routing/algorithms.py

#### 4.6.1 Definiciones

- Sea G = (V, E) un grafo dirigido con V nodos y E aristas.
- Cada arista e = (u, v) tiene un costo no negativo:
- w(u, v) ≥ 0
- El costo total de una ruta P = (v0, v1, ..., vk) es:
- C(P) = Σ_{i=0..k-1} w(vi, v{i+1})

#### 4.6.2 Peso base de arista (travel_time)

- El peso principal se toma de:
- travel_time (segundos)
- Si falta el atributo, se usa un valor por defecto.
- Se normaliza para evitar valores negativos.

#### 4.6.3 Penalizaciones por evento y tipo de vía

- Se aplica una función de penalización:
- w'(u, v) = apply_penalties(w(u, v), highway(u, v), event_type, vehicle_profile)
- Objetivo:
- Simular que ciertos eventos aumentan el tiempo de viaje.
- Ejemplos conceptuales:
- En lluvia: se incrementa el costo en vías rápidas o con mayor riesgo.
- En tráfico: se penalizan arterias principales.
- En protesta/paro: se penalizan zonas o tipos de vía (según reglas).
- Importante:
- Penalizaciones aumentan el costo:
- w'(u, v) ≥ w(u, v)
- Esto mantiene consistencia: la ruta óptima bajo evento no puede ser “más barata” que sin evento.

#### 4.6.4 Dijkstra (óptimo garantizado)

- Dijkstra encuentra el camino de costo mínimo desde un origen s a todos los nodos.
- Condición:
- Todos los pesos deben ser no negativos.
- Invariante:
- Cuando un nodo u se “finaliza”, su distancia d(u) es óptima.
- Complejidad aproximada:
- O(E log V) con cola de prioridad.
- En este proyecto:
- Se ejecuta con rustworkx para rendimiento.
- Considera multiedges escogiendo el costo mínimo entre aristas paralelas.

#### 4.6.5 A* (óptimo si la heurística es admisible)

- A* busca el camino mínimo desde s a t con ayuda de una heurística h(n).
- Define:
- g(n): costo real desde s hasta n.
- h(n): estimación de costo desde n hasta t.
- f(n) = g(n) + h(n)
- A* expande nodos según f(n).
- Admisibilidad:
- h(n) ≤ costo_real_min(n → t)
- Si h es admisible y w ≥ 0, A* encuentra el óptimo.

#### 4.6.6 Heurística Haversine (tiempo estimado)

- Se usa distancia geodésica (Haversine) entre dos nodos.
- Variables:
- lat1, lon1: coordenadas del nodo n.
- lat2, lon2: coordenadas del nodo objetivo t.
- R: radio aproximado de la Tierra (≈ 6 371 000 m).
- Fórmula:
- dLat = lat2 - lat1
- dLon = lon2 - lon1
- a = sin²(dLat/2) + cos(lat1) cos(lat2) sin²(dLon/2)
- c = 2 atan2(√a, √(1-a))
- dist_m = R * c
- Para convertir a tiempo, se usa una velocidad máxima optimista:
- h(n) = dist_m / v_max
- Donde v_max se elige alto para no sobreestimar tiempos.

#### 4.6.7 Nota sobre multiedges

- En grafos viales reales puede haber varias aristas entre los mismos nodos:
- Diferentes carriles, sentidos, o segmentos.
- El costo efectivo entre u y v se toma como:
- w_eff(u, v) = min_{e∈E(u,v)} w'(e)
- Esto asegura que el algoritmo no “pierda” una mejor alternativa por tomar una arista arbitraria.

### 4.7 Backend — Simulación (Monte Carlo)

Ubicación: app/services/simulation/engine.py

#### 4.7.1 Motivación

- Una simulación permite modelar la variabilidad del mundo real.
- En logística, el tiempo real puede desviarse por:
- Clima.
- Tráfico.
- Bloqueos/paro (STRIKE).
- Variabilidad estocástica (incertidumbre).

#### 4.7.2 Estados principales (SimulationState)

- NORMAL
- RAIN
- TRAFFIC
- STRIKE

#### 4.7.3 Monte Carlo

- En vez de un único valor determinístico, se simulan múltiples realizaciones.
- Sea X la variable “duración simulada”.
- Se generan N muestras:
- X1, X2, ..., XN
- Métricas:
- Media:
- μ = (1/N) Σ Xi
- Desviación estándar (muestral, simplificada):
- σ = sqrt( (1/N) Σ (Xi - μ)² )
- Coeficiente de variación:
- CV% = (σ / μ) * 100

#### 4.7.4 Intervalo de confianza (95%)

- Aproximación normal:
- IC 95% ≈ μ ± 1.96 * (σ / √N)
- Donde:
- 1.96 es el valor típico para 95% bajo normalidad.
- Interpretación:
- Con alta N, el IC se estrecha.
- Un IC demasiado estrecho puede indicar una simulación poco estocástica.

#### 4.7.5 KPI de puntualidad (ejemplo conceptual)

- Se define un score de puntualidad en escala 0–100.
- Un enfoque típico:
- Definir un umbral T_base.
- Si la duración simulada T_sim no excede significativamente:
- score alto.
- Si excede mucho:
- score bajo.
- Es decir:
- punctuality_score = f(T_sim / T_base)
- Con f decreciente.

### 4.8 Backend — Modelos de Machine Learning

Los modelos se encuentran en app/ml.

#### 4.8.1 Modelo ETA (XGBoost) — app/ml/eta_predictor.py

- Objetivo:
- Predecir duración (minutos) de un viaje/entrega.
- Entradas (features):
- distance_km
- base_duration_min
- traffic_level
- rain_intensity
- day_of_week, hour_of_day
- is_weekend, is_peak_hour
- road_type_primary_ratio
- Modelo:
- XGBoost Regressor.

##### 4.8.1.1 Formulación (nivel conceptual)

- XGBoost aprende un ensamble de árboles.
- Predicción:
- ŷ = Σ_{m=1..M} f_m(x)
- Donde cada f_m es un árbol de decisión.
- Entrenamiento:
- Minimiza una función objetivo:
- L = Σ l(y_i, ŷ_i) + Σ Ω(f_m)
- l: pérdida (para regresión, típicamente error cuadrático).
- Ω: regularización (complejidad del árbol).

##### 4.8.1.2 Métricas de evaluación (regresión)

- Error absoluto medio (MAE):
- MAE = (1/N) Σ |y_i - ŷ_i|
- Error cuadrático medio (MSE):
- MSE = (1/N) Σ (y_i - ŷ_i)²
- Raíz del MSE (RMSE):
- RMSE = √MSE
- Coeficiente de determinación (R²):
- SS_res = Σ (y_i - ŷ_i)²
- SS_tot = Σ (y_i - ȳ)²
- R² = 1 - (SS_res / SS_tot)
- Interpretación:
- R² cercano a 1: el modelo explica gran parte de la variabilidad.
- R² cercano a 0: el modelo explica poco más que el promedio.

##### 4.8.1.3 Clasificación derivada (Late vs OnTime)

- Aunque ETA es regresión, se define una clasificación auxiliar:
- ratio_i = y_true / base_duration
- late si ratio_i > threshold_ratio
- on_time si ratio_i ≤ threshold_ratio

##### 4.8.1.4 Métricas de clasificación

- Matriz de confusión:
- TP: predijo late y era late.
- TN: predijo on_time y era on_time.
- FP: predijo late pero era on_time.
- FN: predijo on_time pero era late.
- Tasa de verdaderos positivos:
- TPR = TP / (TP + FN)
- Tasa de falsos positivos:
- FPR = FP / (FP + TN)
- Curva ROC:
- Se grafica TPR vs FPR variando el umbral.
- AUC:
- Área bajo la curva ROC.
- Interpretación:
- AUC ≈ 0.5: no discrimina (similar al azar).
- AUC → 1: excelente discriminación.

#### 4.8.2 Modelo Impacto (XGBoost) — app/ml/impact_predictor.py

- Objetivo:
- Predecir impactos operacionales/ambientales a partir de condiciones de entrega.
- Ejemplos de targets:
- CO2 reducido.
- Reducción de desperdicio.
- Mejora de eficiencia.
- Este modelo se evalúa también con:
- R² por target.
- Comparación train vs test.
- Validación cruzada (CV) por escenario.

#### 4.8.3 Modelo Demanda (Prophet) — app/ml/demand_forecasting

- Objetivo:
- Predecir demanda diaria por producto en horizonte corto.
- Modelo:
- Prophet modela la serie con:
- Tendencia.
- Estacionalidades.
- Efectos de calendario.

##### 4.8.3.1 Formulación conceptual de Prophet

- Descompone:
- y(t) = g(t) + s(t) + ε(t)
- g(t): tendencia (piecewise linear o logística).
- s(t): estacionalidad (por Fourier).
- ε(t): ruido.

##### 4.8.3.2 Preprocesamiento aplicado

- Conversión de fechas:
- ds → datetime.
- Conversión de y:
- y → numérico, NaN → 0, y ≥ 0.
- Reindex diario:
- Se completa la serie para todos los días del rango.
- Supuesto:
- Días faltantes se interpretan como demanda 0 (en el dataset sintético).

##### 4.8.3.3 Métricas de evaluación (demanda)

- MAE y RMSE como en regresión.
- MAPE robusto:
- MAPE = mean( |y - ŷ| / max(|y|, ε) ) * 100
- Donde ε evita explosiones cuando y es muy pequeño.
- sMAPE:
- sMAPE = mean( 2|y-ŷ| / (|y| + |ŷ| + ε) ) * 100
- wMAPE:
- wMAPE = (Σ |y-ŷ| / max(Σ |y|, εN)) * 100
- R²:
- Igual definición estándar.
- Interpretación práctica:
- Para series con mucho ruido o variabilidad, R² puede ser modesto aunque el error porcentual sea razonable.

---

## 5) API del Backend (Resumen orientado a producto)

Ubicación: backend/app/main.py

### 5.1 Endpoints base

- Prefijo: /api
- Respuestas: JSON

### 5.2 Productos

- GET /api/products
- Retorna lista de productos con id, nombre, precio, unidad, imagen.

### 5.3 Vendedores

- GET /api/sellers?product_id=<id>
- Filtra vendedores por producto.

### 5.4 Rutas

- POST /api/routes
- Entrada:
- origen/destino y parámetros (según request).
- Salida:
- lista de rutas candidatas (RouteResult) con:
- path (IDs de nodos)
- route_geometry (lat/lon)
- duration_min, distance_km

### 5.5 Recalcular ruta por evento

- POST /api/routes/recalculate
- Entrada:
- ruta actual, evento y parámetros.
- Salida:
- ruta ajustada y métricas actualizadas.

### 5.6 Simulación

- POST /api/simulate
- Entrada:
- ruta seleccionada + parámetros.
- Salida:
- métricas por paso, eventos y métricas globales.

### 5.7 Validación y métricas del sistema

- GET /api/validation/stats
- Retorna:
- routing:
- speedup_factor, matches, samples
- series de tiempos y discrepancias
- per_event (cobertura bajo eventos)
- simulation:
- n_simulations, mean, std, cv%, IC 95%
- durations_sample, punctuality_sample

### 5.8 Evaluación de modelos

- GET /api/models/eta/evaluate
- Evalúa calidad del modelo ETA + métricas de clasificación derivada.
- POST /api/models/eta/train_mock
- Entrena un modelo mock (sintético) con split train/test.
- GET /api/models/impact/evaluate
- Evalúa modelo impacto y generalización.
- GET /api/models/demand/evaluate_fast?product=<id>
- Evalúa Prophet por producto con un holdout rápido.

---

## 6) Documentación del Frontend

### 6.1 Frontend — Tecnología y ejecución

- Lenguaje: TypeScript.
- Framework: React.
- Bundler: Vite.
- Estilos: TailwindCSS (directivas @tailwind en src/index.css).
- Gráficos: Recharts.
- Estado global: Zustand.
- Directorio principal: frontend/src.

### 6.2 Frontend — Estructura de carpetas

- pages/
- Home.tsx:
- Pantalla principal: mapa, selección, simulación.
- ValidationDashboard.tsx:
- Dashboard de validación y modelos.
- components/
- DarkMap.tsx:
- Renderiza mapa y rutas.
- MetricsDashboard.tsx:
- Panel de métricas globales (admin/operación).
- ProductSimulator.tsx:
- Simulador por producto (interfaz de demo).
- hooks/
- useSimulationController.ts:
- Controla la simulación, eventos y actualización de ruta.
- store/
- useStore.ts:
- Estado central (rutas, producto, simulación, métricas).
- services/
- api.ts:
- Cliente API con fallback y manejo de errores.
- api/generated/
- Cliente OpenAPI generado (DefaultService, modelos).
- types/
- modelEvaluation.ts:
- Tipos auxiliares para el dashboard de validación.

### 6.3 Visualización de datos (principios generales)

- Los gráficos deben:
- Tener contenedor con altura explícita (para ResponsiveContainer).
- Renderizar tooltips consistentes (en fondo oscuro).
- Evitar resaltados visuales confusos (cursor/hover) que oculten datos.
- Mostrar estado “Sin datos” cuando el backend no responde.
- Mantener coherencia visual con el tema oscuro.

### 6.4 Dashboard de validación (pages/ValidationDashboard.tsx)

#### 6.4.1 Fuentes de datos (APIs)

- Productos:
- getProducts()
- Validación:
- getValidationStats() → /api/validation/stats
- ETA:
- getEtaEvaluation()
- Impacto:
- getImpactEvaluation()
- Demanda:
- getDemandModelEvaluationFast(product_id)
- Estado de modelos:
- getDemandModelsStatus()

#### 6.4.2 Secciones y navegación

- Resumen:
- Checklist de validaciones.
- Mini-cards de ruteo y Monte Carlo.
- Ruteo:
- Comparativa de tiempos (Dijkstra vs A*).
- Series por muestra.
- Histograma de discrepancia de costo.
- Cobertura bajo eventos.
- Monte Carlo:
- Serie de duración.
- Histograma de duración.
- Serie de puntualidad.
- ETA:
- Métricas MAE/RMSE/R².
- ROC + matriz de confusión (Late vs OnTime).
- Residuales.
- Impacto:
- Comparativa train/test y CV.
- Radar por área.
- Demanda:
- Cobertura por producto.
- Comparativa sMAPE por producto.
- Serie real vs predicción por producto.
- Productos:
- Tabla de catálogo con imagen y precios.

#### 6.4.3 Flujo de datos (de backend a UI)

- En el montaje:
- Se ejecutan peticiones en paralelo (Promise.allSettled).
- Se guardan resultados en estados:
- routingStats, simStats.
- etaEval, impactEval.
- demandEvals, demandStatus.
- Si falla /api/validation/stats:
- Se muestra un alert.
- Los gráficos se reemplazan por placeholders “Sin datos”.

#### 6.4.4 Accesibilidad

- Los estados críticos usan role="alert" para avisos.
- El checklist se renderiza con role="list" y secciones con aria-labelledby.
- Los textos de estado (OK/Atención/Crítico) se muestran como etiquetas claras.

### 6.5 Mapa y simulación (components/DarkMap.tsx + hooks/useSimulationController.ts)

#### 6.5.1 Objetivo

- Mostrar rutas calculadas sobre un mapa oscuro.
- Animar un marcador de vehículo durante la simulación.
- Reaccionar a eventos (lluvia, tráfico, etc.).
- Recalcular ruta cuando corresponda.

#### 6.5.2 Flujo de recalculo de ruta

- Durante simulación:
- Se detecta un evento.
- Se llama al endpoint de recálculo.
- Se obtiene una nueva geometría (route_geometry).
- La geometría se combina con el tramo recorrido:
- combinedPath = traveledPath + newGeometry
- Se actualiza:
- dynamicPath (lo que se dibuja).
- route_geometry de la ruta seleccionada en el store.
- Esto asegura que:
- El mapa y el estado global reflejan la ruta actual.
- El vehículo continúa sobre la nueva ruta.

### 6.6 Puesta en marcha del Frontend

#### 6.6.1 Requisitos previos

- Node.js (recomendado LTS).
- npm (incluido con Node).

#### 6.6.2 Instalación

- Ir a frontend/
- Ejecutar:
- npm install

#### 6.6.3 Desarrollo

- Ejecutar:
- npm run dev
- Abrir:
- http://127.0.0.1:5173/

#### 6.6.4 Build

- Ejecutar:
- npm run build
- (Opcional) Previsualizar:
- npm run preview

---

## 7) Puesta en Marcha del Backend

### 7.1 Requisitos previos

- Python 3.10+ recomendado.
- Entorno virtual (venv).
- Dependencias del proyecto instaladas.
- Archivo del grafo disponible:
- data/processed/portoviejo_graph.graphml

### 7.2 Instalación (entorno virtual)

- Ir a backend/
- Crear entorno virtual:
- python -m venv .venv
- Activar entorno:
- Windows PowerShell:
- .\.venv\Scripts\Activate.ps1
- Instalar dependencias:
- pip install -r requirements.txt
- Nota:
- Si el proyecto no incluye requirements.txt, se recomienda generarlo desde el entorno actual.

### 7.3 Variables de entorno

- Opcional crear backend/.env con:
- LOG_LEVEL=INFO
- ENABLE_METRICS=true
- Ajustar CORS si se cambia el host/puerto del frontend.

### 7.4 Migraciones / DB

- No hay un sistema de migraciones formal.
- SQLite se inicializa con `_init_schema()` al primer arranque.
- Las tablas se crean si no existen.
- Se hace seed si las tablas están vacías.

### 7.5 Ejecutar el servidor (desarrollo)

- Desde backend/:
- uvicorn app.main:app --host 127.0.0.1 --port 8000

### 7.6 Ejecutar el servidor (producción)

- Recomendaciones:
- Usar un servidor ASGI con workers (según tráfico).
- Configurar reverse proxy (Nginx) y TLS.
- Externalizar persistencia si se requiere durabilidad real (PostgreSQL).
- Monitorizar recursos (RAM) por carga del grafo en memoria.

---

## 8) Criterios de Calidad y Validación

### 8.1 ¿Qué valida el dashboard?

- Que el sistema está “conectado”:
- APIs respondiendo con datos.
- Que los algoritmos están alineados:
- Dijkstra vs A* deben producir el mismo costo (match).
- Que la simulación no es degenerada:
- CV y distribución deben mostrar variabilidad razonable.
- Que los modelos están en rangos esperados:
- ETA: R² alto pero no “perfecto” irreal.
- Impacto: R² y CV coherentes.
- Demanda: error porcentual estable, sin explosiones.

### 8.2 Señales de alerta comunes

- Gráficos vacíos:
- Endpoint falló o devolvió arrays vacíos.
- CV=0 e IC muy estrecho:
- simulación demasiado determinista o fallo de cálculo.
- R² muy bajo en ETA:
- falta de señal en features o datos corruptos.
- MAPE enorme en Demanda:
- demanda real muy pequeña sin métrica robusta (por eso se usa sMAPE/wMAPE).

### 8.3 Pruebas automatizadas

- Backend:
- pytest (carpeta backend/tests).
- Frontend:
- vitest (carpeta frontend/src/**/__tests__).
- Objetivo:
- Proteger funciones matemáticas críticas.
- Asegurar que hooks de simulación mantengan comportamiento esperado.

---

## 9) Guía de Troubleshooting

### 9.1 “Los gráficos no muestran datos”

- Verificar que el backend está corriendo:
- http://127.0.0.1:8000
- Verificar /api/validation/stats:
- Debe devolver routing y simulation con arrays no vacíos.
- Verificar que el grafo cargó al iniciar:
- En logs debe decir cuántos nodos se cargaron.

### 9.2 “CORS bloquea llamadas desde el frontend”

- Revisar BACKEND_CORS_ORIGINS en app/core/config.py.
- Asegurar que incluye el origen exacto del frontend:
- http://127.0.0.1:5173

### 9.3 “No existe el archivo del grafo”

- Confirmar que data/processed/portoviejo_graph.graphml existe.
- Si falta:
- Reincorporar el archivo al repositorio o regenerarlo desde pipeline de datos.

### 9.4 “SQLite está bloqueado”

- Cerrar procesos que usen el archivo.
- Verificar que WAL esté habilitado.
- Reiniciar el backend.

---

## 10) Glosario

- ETA:
- Estimated Time of Arrival (tiempo estimado de llegada).
- KPI:
- Indicador clave de desempeño.
- Grafo:
- Modelo de nodos y aristas para representar la red vial.
- Heurística:
- Estimación usada por A* para guiar la búsqueda.
- Admisible:
- Heurística que nunca sobreestima el costo real mínimo.
- Monte Carlo:
- Técnica de simulación basada en repetición aleatoria.
- MAE/RMSE:
- Errores para medir precisión de predicción en regresión.
- R²:
- Medida de proporción de varianza explicada por un modelo.
- ROC/AUC:
- Curva y área para evaluar clasificación binaria.
- sMAPE/wMAPE:
- Métricas porcentuales robustas para demanda.

---

## 11) Apéndice A — Referencia de archivos clave

- Backend:
- backend/app/main.py
- backend/app/services/routing/algorithms.py
- backend/app/services/simulation/engine.py
- backend/app/services/validation/validator_service.py
- backend/app/core/localdb.py
- backend/app/ml/eta_predictor.py
- backend/app/ml/impact_predictor.py
- backend/app/ml/demand_forecasting/forecaster.py
- Frontend:
- frontend/src/pages/ValidationDashboard.tsx
- frontend/src/components/DarkMap.tsx
- frontend/src/hooks/useSimulationController.ts
- frontend/src/store/useStore.ts
- frontend/src/services/api.ts

---

Fin del documento.

</details>
