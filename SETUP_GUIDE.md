# SETUP_GUIDE — TuDistri (Ruta_Op)

Guía práctica, detallada y reproducible para **configurar, levantar y verificar** el proyecto en un entorno local/de desarrollo. Está escrita para que funcione tanto para principiantes (paso a paso) como para usuarios avanzados (atalajos y verificaciones rápidas).

> Recomendación: abre 2 terminales (una para backend y otra para frontend).

---

## 1) Requisitos previos

### 1.1 Software requerido

**Backend**
- Python **3.10+** (recomendado 3.11)
- `pip` (incluido con Python)
- (Recomendado) `venv` (incluido con Python)

**Frontend**
- Node.js **LTS** (recomendado 18+ o 20+)
- npm (incluido con Node)

### 1.2 Requisitos del repositorio

- Archivo del grafo (obligatorio para ruteo):
  - `data/processed/portoviejo_graph.graphml`
  - Si falta, el backend no podrá calcular rutas y validaciones de ruteo fallarán.

### 1.3 Puertos por defecto

- Backend: `http://127.0.0.1:8000`
- Frontend: `http://127.0.0.1:5173`

> Si cambias puertos/host, revisa CORS en `backend/app/core/config.py`.

---

## 2) Clonar y preparar el proyecto

> Si ya tienes el repositorio descargado, salta a la sección 3.

```bash
git clone <URL_DEL_REPOSITORIO>
cd Ruta_Op
```

---

## 3) Configuración del Backend (FastAPI)

### 3.1 Crear entorno virtual

#### Windows (PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -V
```

#### macOS/Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -V
```

### 3.2 Instalar dependencias

Si existe `requirements.txt`:

```bash
pip install -r requirements.txt
```

Si no existe `requirements.txt` en tu copia (caso de desarrollo), instala al menos:

```bash
pip install fastapi uvicorn pydantic pydantic-settings numpy pandas scikit-learn joblib xgboost networkx osmnx rustworkx
```

> Nota: este proyecto carga un grafo y usa ML; si tu instalación falla por compilación, usa una versión de Python LTS y actualiza pip.

### 3.3 Variables de entorno (opcional)

El backend puede leer un archivo `backend/.env`. Ejemplo:

```env
LOG_LEVEL=INFO
ENABLE_METRICS=true
```

### 3.4 Levantar el backend

Desde `backend/` (con el venv activo):

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 3.5 Verificar backend

En el navegador:

- Documentación interactiva: `http://127.0.0.1:8000/docs`
- Salud (respuesta esperada JSON): `http://127.0.0.1:8000/api/validation/stats`

Verificación rápida en terminal (opcional):

```bash
python -c "import requests; print(requests.get('http://127.0.0.1:8000/api/validation/stats').status_code)"
```

> Esperado: `200`

### 3.6 Ejecutar tests del backend

Desde `backend/`:

```bash
python -m pytest -q
```

> Esperado: todos los tests pasan.

---

## 4) Configuración del Frontend (React + Vite)

### 4.1 Instalar dependencias

En otra terminal:

```bash
cd frontend
npm install
```

### 4.2 Levantar el frontend

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Abrir:
- `http://127.0.0.1:5173/`

### 4.3 Verificar frontend

- Navega a la pantalla principal (mapa).
- Abre el dashboard de validación (según la ruta definida en el router).
- Deberías ver:
  - métricas de ruteo (matches/samples, speedup, series),
  - métricas de Monte Carlo (CV%, series),
  - métricas de modelos (ETA/Impacto/Demanda).

### 4.4 Lint y tests del frontend

```bash
npm run lint
npm test
```

> Esperado: sin errores.

---

## 5) Verificación end-to-end (E2E manual)

### 5.1 Checklist rápido

1) Backend corriendo sin errores y mostrando “Graph loaded successfully…”.
2) Frontend abre sin pantallas en blanco.
3) `/api/validation/stats` responde 200 y contiene arrays no vacíos:
   - `routing.dijkstra_times_ms` con longitud > 0
   - `simulation.durations_sample` con longitud > 1

### 5.2 Señales visuales correctas en el dashboard

- Si un endpoint falla, se muestra una **alerta** con mensaje accionable (no un gráfico vacío).
- Los gráficos tienen tooltips coherentes y no presentan resaltado extraño al hover.
- Las fórmulas (texto) se renderizan bien y pueden copiarse.

---

## 6) Solución de problemas comunes (Troubleshooting)

### 6.1 “El dashboard muestra ‘Sin datos’ en Ruteo/Monte Carlo”

**Causas probables**
- El backend no está corriendo o falló al iniciar.
- El archivo del grafo no existe o no se pudo cargar.
- La API devolvió un JSON con formato inesperado.

**Soluciones**
- Revisa que el backend esté arriba: `http://127.0.0.1:8000/docs`
- Revisa logs: debe aparecer “Graph loaded successfully…”.
- Prueba endpoint directo:
  - `http://127.0.0.1:8000/api/validation/stats`

### 6.2 “CORS bloquea llamadas desde el frontend”

**Causa**
- El origen del frontend no está en `BACKEND_CORS_ORIGINS`.

**Solución**
- Edita `backend/app/core/config.py` y agrega el origen:
  - `http://127.0.0.1:5173`
- Reinicia el backend.

### 6.3 “pip install falla con dependencias pesadas”

**Causas probables**
- Versión de Python incompatible.
- Falta de compiladores/herramientas del sistema.

**Soluciones**
- Usa Python 3.11.
- Actualiza pip:

```bash
python -m pip install --upgrade pip
```

### 6.4 “El puerto está ocupado”

**Síntoma**
- Error al iniciar backend o frontend por puerto en uso.

**Solución**
- Cambia el puerto:
  - Backend: `--port 8001`
  - Frontend: `--port 5174`
- Si cambias el frontend, revisa CORS del backend.

### 6.5 “ValidationError 422 al llamar endpoints”

**Causa**
- El backend valida rangos/valores (lat/lng, product_id, event_type, progress, weight).

**Solución**
- Lee el JSON `details` del error; incluye campo y mensaje.
- Corrige el request y reintenta.

---

## 7) “Recetas” para usuarios avanzados

### 7.1 Generar cliente OpenAPI (frontend)

Con backend corriendo:

```bash
cd frontend
npm run generate-api
```

### 7.2 Validación mínima por script

```bash
python -c "import requests; d=requests.get('http://127.0.0.1:8000/api/validation/stats').json(); print('routing.samples', d['routing']['samples']); print('sim.len', len(d['simulation']['durations_sample']))"
```

---

Fin de la guía.
