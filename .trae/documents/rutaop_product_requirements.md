# 📋 Requisitos del Producto (PRD) - RutaOp

## 📄 Introducción
RutaOp nace como una solución tecnológica para mitigar los desafíos logísticos en el sector agroalimentario de Portoviejo. El propósito de este producto es centralizar en una sola plataforma web la optimización de rutas de transporte y el monitoreo de la cadena de suministro, garantizando transparencia y eficiencia desde el productor hasta el consumidor final.

---

## 🎯 Objetivos Estratégicos
1.  **Eficiencia Logística**: Reducir los tiempos de entrega y costos operativos mediante algoritmos de ruta óptima.
2.  **Transparencia**: Implementar un sistema de trazabilidad basado en datos verificables (Blockchain).
3.  **Sostenibilidad**: Medir y reportar el impacto ambiental (CO2) de las operaciones logísticas.
4.  **Experiencia de Usuario**: Proporcionar una interfaz moderna, intuitiva y funcional para múltiples perfiles de usuario.

---

## 👥 Perfiles de Usuario (Roles)
| Rol | Necesidad Principal | Funcionalidad Clave |
|-----|-------------------|---------------------|
| **Cliente** | Comprar productos frescos y saber de dónde vienen. | Mapa interactivo, trazabilidad, calificación de servicio. |
| **Distribuidor** | Entregar productos al menor costo y tiempo posible. | Cálculo de rutas óptimas, métricas de beneficio, simulación de carga. |
| **Administrador** | Supervisar el ecosistema logístico completo. | Gestión de POIs, reporte global de sostenibilidad, monitoreo de tráfico. |

---

## 🛠️ Requisitos Funcionales

### 1. Módulo de Mapa e Interacción
- **RF1.1**: Visualización de mapa base con tema oscuro y capas satelitales.
- **RF1.2**: Marcado de ubicación del usuario mediante clic directo en el mapa.
- **RF1.3**: Visualización de Puntos de Interés (POI) categorizados.

### 2. Módulo de Optimización Logística
- **RF2.1**: Cálculo de rutas óptimas basado en el producto seleccionado y la ubicación del usuario.
- **RF2.2**: Simulación animada del trayecto del vehículo (estilo Uber Eats).
- **RF2.3**: Recálculo dinámico de costos según el peso de la carga (QQ).

### 3. Módulo de Trazabilidad y KPIs
- **RF3.1**: Visualización de la cadena de suministro (Origen -> Destino).
- **RF3.2**: Reporte de métricas de sostenibilidad (Emisiones CO2, Energía).
- **RF3.3**: Verificación de integridad del lote mediante hash de Blockchain.

---

## 📐 Diseño de Interfaz (UI/UX)
- **Estilo**: Tema oscuro (#121212) para reducir la fatiga visual.
- **Componentes**: Sidebar colapsable para selección de productos, dashboard flotante para métricas.
- **Interactividad**: Transiciones suaves (0.3s) y animaciones de carga para mejorar la percepción de velocidad.

---

## 🔒 Requisitos No Funcionales
- **Rendimiento**: El cálculo de la ruta óptima debe completarse en menos de 500ms.
- **Disponibilidad**: La plataforma debe ser accesible 24/7 con un uptime del 99.9%.
- **Seguridad**: Encriptación de datos sensibles y protección contra ataques CSRF/XSS.
- **Escalabilidad**: El backend debe soportar el procesamiento de grafos viales de ciudades completas sin degradación de servicio.

---

## 🔗 Recursos y Documentación
- [Arquitectura Técnica Detallada](rutaop_technical_architecture.md)
- [Manual de Usuario](MANUAL_USUARIO.md)
- [Figma Design System](https://figma.com/rutaop-design)
