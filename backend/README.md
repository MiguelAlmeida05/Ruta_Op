# TuDestri Backend

El backend de TuDestri es el núcleo computacional de la plataforma, encargado del procesamiento geoespacial, la simulación de escenarios y la exposición de la API REST.

## Arquitectura

El backend sigue una arquitectura modular inspirada en **Clean Architecture**, separando capas de servicio, lógica de negocio y acceso a datos.

*   **Framework**: FastAPI (Alto rendimiento, validación automática).
*   **Lenguaje**: Python 3.9+.
*   **Geospatial**: NetworkX, OSMnx, Rustworkx (para optimización).
*   **ML/Simulación**: Scikit-learn, Prophet, Numpy.

## Requisitos del Sistema

*   Python 3.10 o superior.
*   Bibliotecas de sistema para geoprocesamiento (ver `Dockerfile`):
    *   `libspatialindex-dev`
    *   `libgdal-dev`
    *   `g++`

## Estructura de Archivos Clave

*   **`app/`**: Código fuente principal.
*   **`validation/`**: Scripts para validación estadística y dashboards de explicabilidad.
*   **`scripts/`**: Utilidades de mantenimiento y prueba.
*   **`tests/`**: Suite de pruebas unitarias (`pytest`).
*   **`Dockerfile`**: Definición de la imagen de contenedor para despliegue.
*   **`requirements.txt`**: Lista de dependencias de Python.

## Configuración y Ejecución

1.  **Instalar Dependencias**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Iniciar Servidor (Desarrollo)**:
    ```bash
    uvicorn app.main:app --reload
    ```
    El servidor estará disponible en `http://localhost:8000`.

3.  **Ejecutar Pruebas**:
    ```bash
    pytest
    ```

## Archivos de Configuración

*   **`__init__.py`**: Marca el directorio como un paquete Python. Generalmente vacío para evitar efectos secundarios en la importación.
*   **`requirements.txt`**: Define las versiones exactas de las librerías necesarias. Incluye dependencias pesadas como `torch`, `prophet` y `osmnx`.
*   **`Dockerfile`**: Configura un entorno Linux (Debian-slim) con las dependencias de sistema necesarias para compilar librerías geográficas antes de instalar los paquetes de Python. **Nota:** Verificar el `CMD` final antes de construir.
