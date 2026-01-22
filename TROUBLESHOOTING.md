# Guía de Solución de Problemas (Troubleshooting)

Este documento detalla los problemas recientes identificados en el sistema TuDistri, sus causas raíz y las soluciones implementadas.

## 1. Error de Carga de Mapa (net::ERR_ABORTED)

**Síntoma:**
La consola del navegador muestra errores `net::ERR_ABORTED` al intentar cargar tiles del mapa base de CartoDB:
`https://b.basemaps.cartocdn.com/dark_all/14/4527/8239.png`

**Causa Raíz:**
- Fallos intermitentes en la conexión con el proveedor de tiles (CartoCDN).
- Posible bloqueo de red o indisponibilidad temporal de tiles específicos.

**Solución Implementada:**
- Se agregó la propiedad `errorTileUrl` al componente `TileLayer` en `frontend/src/components/DarkMap.tsx`.
- Ahora, si un tile falla al cargar, se mostrará un placeholder visual ("Map Tile Error") en lugar de dejar el espacio vacío o generar un icono de imagen rota, mejorando la experiencia de usuario.

## 2. Fallo en Cálculo y Visualización de Rutas

**Síntoma:**
- Al hacer clic en "Simular", no se mostraban rutas en el mapa.
- El backend devolvía una lista vacía de rutas o un error 500.
- Logs del backend mostraban: `NameError: name 'math' is not defined`.

**Causa Raíz:**
- El archivo principal del backend (`backend/app/main.py`) utilizaba funciones matemáticas (`math.isinf`, `math.isnan`) para validar costos de ruta, pero faltaba la importación del módulo `math`.
- Esto causaba que el cálculo de rutas fallara silenciosamente (capturado por un bloque `try/except` genérico) y se omitieran todas las rutas válidas.

**Solución Implementada:**
- Se añadió `import math` en `backend/app/main.py`.
- Se verificó que el cálculo de rutas ahora se completa exitosamente y devuelve las geometrías para su renderizado.

## 3. Errores 404 en Logs (Opcional)

**Síntoma:**
- Logs mostrando `GET /products 404 Not Found` (sin prefijo `/api`).

**Análisis:**
- El frontend está configurado para usar `/api` como prefijo base.
- Los errores 404 pueden deberse a caché antiguo en el navegador o a configuraciones de prueba que no usan el prefijo correcto.
- El flujo principal de la aplicación utiliza correctamente `/api/products` y `/api/sellers`, como se verifica en los logs exitosos (200 OK).

## Recomendaciones Futuras

1.  **Monitoreo de Tiles**: Considerar cambiar a un proveedor de mapas con API Key (Mapbox, Stadia) si los errores de CartoDB persisten frecuentemente.
2.  **Validación de Dependencias**: Utilizar linters (como `flake8` o `pylint`) en el backend para detectar variables o módulos no definidos antes de la ejecución.
3.  **Manejo de Errores Frontend**: Implementar notificaciones visuales (Toasts) más descriptivas cuando el backend devuelva una lista vacía de rutas, indicando si fue por falta de datos o error interno.
