# Optimización y Análisis de Rutas Urbanas - Portoviejo

Este proyecto académico implementa un sistema de optimización de rutas y análisis logístico para la ciudad de Portoviejo, Ecuador. Utiliza grafos (OSNMX), algoritmos de búsqueda (Dijkstra, A*), simulación de tráfico y Machine Learning.

## Estructura del Proyecto

- `src/`: Código fuente del backend (carga de datos, algoritmos, simulación, análisis).
- `app.py`: Dashboard interactivo en Streamlit.
- `requirements.txt`: Dependencias del proyecto.
- `verify.py`: Script de verificación de componentes.

## Instalación

Se recomienda usar Anaconda debido a las dependencias geoespaciales (OSMNX, Geopandas).

```bash
conda create -n portoviejo_routes python=3.9
conda activate portoviejo_routes
conda install -c conda-forge osmnx geopandas networkx
pip install -r requirements.txt
```

## Ejecución

Para iniciar el dashboard interactivo:

```bash
streamlit run app.py
```

## Funcionalidades

1.  **Planificación de Rutas**: Comparación visual y de métricas entre Dijkstra y A*.
2.  **Simulación**: Creación de escenarios de congestión y cierres viales.
3.  **Analítica**:
    *   Predicción de tiempos de viaje (Random Forest).
    *   Estimación Bayesiana de incertidumbre.
