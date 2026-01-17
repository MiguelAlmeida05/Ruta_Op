# 🚀 RutaOp - Optimización Logística y Cadena de Suministro (Portoviejo)

## 📄 Introducción
RutaOp es una plataforma web integral diseñada para transformar la logística urbana y rural en Portoviejo, Ecuador. El propósito de este proyecto es optimizar el transporte de productos agroalimentarios, permitiendo a los distribuidores encontrar rutas de costo mínimo y a los clientes finales verificar la trazabilidad y calidad de los productos mediante tecnologías modernas como Grafos y Blockchain.

Este documento sirve como la guía principal de entrada al proyecto, proporcionando una visión general de la arquitectura, instrucciones de instalación y el flujo de trabajo para desarrolladores y usuarios.

---

## 🏗️ Arquitectura del Sistema
El sistema se basa en una arquitectura desacoplada de alto rendimiento:

- **Backend**: Servidor REST construido con **FastAPI** (Python 3.9+). Utiliza **NetworkX** y **OSMnx** para el procesamiento avanzado de grafos viales y cálculo de rutas óptimas.
- **Frontend**: Aplicación **SPA** desarrollada con **React 18**, **Vite**, **Tailwind CSS** y **Leaflet** para mapas interactivos de alta precisión.
- **Base de Datos**: **Supabase (PostgreSQL)** para la gestión de usuarios, productos y trazabilidad.
- **Algoritmos**: Implementación optimizada de **Dijkstra** y **A*** para garantizar tiempos de respuesta rápidos en el cálculo de trayectos.

---

## 📁 Estructura del Proyecto
```text
rutaop/
├── backend/            # Lógica del servidor, APIs y algoritmos de grafos.
│   ├── api/            # Endpoints y controladores FastAPI.
│   ├── tests/          # Pruebas unitarias para algoritmos.
│   └── data_loader.py  # Procesamiento de grafos viales.
├── frontend/           # Interfaz de usuario interactiva en React.
│   ├── src/            # Componentes, servicios, hooks, páginas y tipos.
│   └── public/         # Recursos estáticos.
├── data/               # Archivos de datos (.graphml) de Portoviejo.
├── supabase/           # Migraciones y configuración de base de datos.
└── .trae/documents/    # Documentación técnica, requisitos y manuales.
```

---

## ⚙️ Instalación y Configuración

### 1. Requisitos Previos
- **Python 3.9+**
- **Node.js 18+** y **npm**
- Una cuenta en **Supabase** (opcional para desarrollo local si se usan datos estáticos).

### 2. Configuración del Backend
1. Navega a la raíz del proyecto y crea un entorno virtual:
   ```bash
   python -m venv .venv
   .\.venv\Scripts\activate
   ```
2. Instalar dependencias:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Configura las variables de entorno en un archivo `.env` en la raíz:
   ```env
   SUPABASE_URL=tu_url_aqui
   SUPABASE_KEY=tu_anon_key_aqui
   ```
4. Iniciar el servidor:
   ```bash
   python -m uvicorn backend.api.main:app --reload
   ```

### 3. Configuración del Frontend
1. Navega al directorio `frontend/`:
   ```bash
   cd frontend
   npm install
   ```
2. Iniciar el entorno de desarrollo:
   ```bash
   npm run dev
   ```

---

## 🛠️ Uso de la Plataforma
1. **Selección de Rol**: Elige entre Cliente, Distribuidor o Administrador en la cabecera.
2. **Simulación de Ruta**: Selecciona un producto y haz clic en el mapa para establecer tu ubicación. Presiona "Simular Rutas".
3. **Animación de Entrega**: En el dashboard superior, haz clic en "Simular Entrega" para ver el vehículo en movimiento.
4. **Verificación de Trazabilidad**: Activa el modo "Trazabilidad" para ver el origen y el hash de Blockchain del producto.

---

## 🔒 Consideraciones de Seguridad
- **Variables de Entorno**: Nunca subas archivos `.env` al repositorio.
- **Autenticación**: Las rutas sensibles del backend requieren validación de tokens de Supabase Auth.
- **Integridad de Datos**: La trazabilidad se asegura mediante hashes inmutables registrados en el modelo de datos.

---

## ❓ Solución de Problemas Comunes
- **Error "CORS"**: Asegúrate de que el backend permita peticiones desde `http://localhost:5173`.
- **Mapa en Negro**: Verifica que tengas conexión a internet para cargar los tiles de CartoDB o que no existan errores de JS en la consola.
- **Backend no carga el Grafo**: Asegúrate de que el archivo `portoviejo_graph.graphml` esté en `data/processed/`.

---

## 🔗 Recursos Adicionales
- [Manual Técnico Detallado](.trae/documents/MANUAL_TECNICO.md)
- [Manual de Usuario Final](.trae/documents/MANUAL_USUARIO.md)
- [Documentación de FastAPI](https://fastapi.tiangolo.com/)
- [Documentación de React](https://react.dev/)
