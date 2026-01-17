# 🛠️ Manual Técnico - RutaOp

## 📄 Introducción
Este manual proporciona una guía técnica profunda sobre la arquitectura, el diseño y la implementación de la plataforma RutaOp. Está dirigido a desarrolladores, ingenieros de datos y administradores de sistemas que necesiten mantener, escalar o integrar nuevas funcionalidades en el ecosistema logístico de Portoviejo.

---

## 🏗️ Arquitectura del Sistema
RutaOp utiliza un modelo de arquitectura cliente-servidor desacoplado para maximizar la escalabilidad y el rendimiento.

### Componentes Principales:
- **Backend (FastAPI)**: Gestiona la lógica de negocio, procesamiento de grafos y exposición de APIs.
- **Algoritmos de Ruta**: Implementaciones personalizadas de Dijkstra y A* sobre grafos de OSMnx.
- **Frontend (React)**: Interfaz interactiva para visualización geoespacial y gestión de datos.
- **Data Layer**: Supabase (PostgreSQL) para persistencia y archivos `.graphml` para datos viales.

---

## 📂 Estructura de Componentes del Frontend

### 1. App.tsx (Contenedor Principal)
Es el orquestador del estado global. Maneja:
- La ubicación del usuario (`userLocation`).
- Las rutas calculadas (`routes`).
- El estado de la simulación de viaje.
- El rol del usuario para adaptar la UI.

### 2. DarkMap.tsx (Visualización Geoespacial)
Integra **React-Leaflet** con funcionalidades avanzadas:
- **Animación de Vehículo**: Simulación estilo Uber Eats mediante `setInterval` y actualización de coordenadas locales.
- **Modos de Visualización**: Soporte para mapas oscuros (CartoDB), satelitales e híbridos.
- **Trazabilidad**: Renderizado dinámico de la cadena de suministro cuando el modo está activo.

### 3. MetricsDashboard.tsx (Panel de KPIs)
Calcula y muestra métricas críticas en tiempo real:
- **Financieras**: Ingresos brutos, costos de transporte y beneficio neto.
- **Sostenibilidad**: Emisiones de CO2, eficiencia energética y ahorro proyectado.
- **Trazabilidad**: Verificación de hashes de Blockchain y origen del lote.

---

## ⚙️ Algoritmos de Optimización de Rutas
El backend utiliza la librería **NetworkX** para representar la red vial de Portoviejo como un grafo dirigido y pesado.

### Implementación Dijkstra Optimizado:
Para mejorar el rendimiento, se utiliza un diccionario de `parents` para reconstruir la ruta al final, reduciendo la complejidad espacial y temporal en comparación con el almacenamiento de caminos completos en la cola de prioridad.

```python
# Ejemplo conceptual del algoritmo optimizado
def run_dijkstra(source, target, G):
    pq = [(0, source)]
    min_dist = {source: 0}
    parents = {source: None}
    
    while pq:
        d, u = heapq.heappop(pq)
        if u == target:
            return reconstruct_path(parents, target)
        # ... lógica de exploración
```

---

## 🔒 Seguridad y Manejo de Datos
1.  **Protección de API**: Los endpoints sensibles están protegidos mediante validación de JWT emitidos por Supabase.
2.  **Sanitización**: Todas las coordenadas de entrada son validadas para asegurar que se encuentren dentro de los límites geográficos de Portoviejo.
3.  **Trazabilidad Inmutable**: Los datos de la cadena de suministro incluyen un hash criptográfico generado al momento del despacho, garantizando que la información del lote no ha sido alterada.

---

## 🛠️ Solución de Problemas Técnicos
- **Falla en el Cálculo de Rutas**: Verifica que el nodo más cercano (`nearest_node`) sea encontrado correctamente. Si el grafo tiene islas desconectadas, el algoritmo podría fallar.
- **Lentitud en el Mapa**: Reduce la cantidad de marcadores de POI visibles simultáneamente mediante el filtrado por zoom o categoría.
- **Errores de Dependencias en Python**: Asegúrate de estar usando un entorno virtual con `Python 3.9`, ya que versiones más recientes pueden tener conflictos con `osmnx`.

---

## 🔗 Recursos para Desarrolladores
- [Repositorio Principal de GitHub](https://github.com/tu-usuario/rutaop)
- [Documentación de OSMnx](https://osmnx.readthedocs.io/)
- [Guía de Supabase Auth](https://supabase.com/docs/guides/auth)
