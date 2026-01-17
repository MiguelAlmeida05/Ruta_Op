# 🎨 RutaOp Frontend - Interfaz de Usuario Logística

## 📄 Introducción
Este es el cliente web de RutaOp, una aplicación moderna construida con **React** y **TypeScript**. La interfaz está diseñada para proporcionar una experiencia de usuario fluida en la gestión logística, permitiendo la visualización de rutas óptimas en tiempo real, simulación de entregas y monitoreo de trazabilidad agroalimentaria en Portoviejo.

El frontend se comunica con un backend de FastAPI para obtener cálculos de rutas basados en grafos y con Supabase para la persistencia de datos y autenticación.

---

## 🏗️ Estructura del Código
```text
src/
├── assets/         # Imágenes, iconos y recursos estáticos.
├── components/     # Componentes reutilizables (Mapa, Dashboard, Sidebar).
│   ├── DarkMap.tsx         # Integración de Leaflet con tema oscuro.
│   ├── MetricsDashboard.tsx # Panel de KPIs y métricas por rol.
│   └── ProductSimulator.tsx # Sidebar de selección y simulación.
├── hooks/          # Hooks personalizados (useTheme, useAuth).
├── services/       # Clientes de API (Axios para backend, Supabase SDK).
├── types.ts        # Definiciones de interfaces TypeScript.
├── App.tsx         # Punto de entrada y gestión de estado global.
└── main.tsx        # Configuración de React y renderizado inicial.
```

---

## ⚙️ Instalación y Desarrollo

### 1. Requisitos Previos
- **Node.js 18.x** o superior.
- **npm** o **yarn**.

### 2. Configuración
1. Instalar las dependencias del proyecto:
   ```bash
   npm install
   ```
2. Crea un archivo `.env` en este directorio con las siguientes variables:
   ```env
   VITE_API_URL=http://localhost:8000/api
   VITE_SUPABASE_URL=tu_url_supabase
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   ```

### 3. Scripts Disponibles
- `npm run dev`: Inicia el servidor de desarrollo con Vite (HMR activado).
- `npm run build`: Genera los archivos de producción en la carpeta `dist/`.
- `npm run lint`: Ejecuta el linter de ESLint para asegurar la calidad del código.
- `npm run preview`: Sirve localmente la versión de producción para pruebas finales.

---

## 🛠️ Tecnologías Utilizadas
- **React 18**: Biblioteca principal para la UI.
- **TypeScript**: Para un desarrollo robusto y tipado.
- **Vite**: Herramienta de construcción ultra rápida.
- **Tailwind CSS**: Framework de utilidades para el diseño visual.
- **Lucide React**: Set de iconos modernos y consistentes.
- **React-Leaflet**: Integración de mapas interactivos.
- **Clsx & Tailwind-Merge**: Para la gestión dinámica de clases CSS.

---

## 🔒 Seguridad y Buenas Prácticas
- **Tipado Estricto**: Se recomienda evitar el uso de `any` para mantener la integridad de los datos.
- **Limpieza de Eventos**: Siempre desuscribirse de eventos de mapa o intervalos de animación en el cleanup de `useEffect`.
- **Variables de Entorno**: Nunca exponer claves privadas. Usa siempre el prefijo `VITE_` para que Vite las reconozca.

---

## ❓ Solución de Problemas
- **Problemas con Leaflet**: Si los iconos del mapa no aparecen, verifica la configuración de `L.Icon.Default` en `DarkMap.tsx`.
- **Error de Conexión con la API**: Asegúrate de que el backend esté corriendo y que la URL en el `.env` sea correcta.
- **Estilos de Tailwind no cargan**: Ejecuta `npm install` nuevamente y asegúrate de que `tailwind.config.js` incluya las rutas de tus componentes.

---

## 🔗 Enlaces Útiles
- [Documentación de React-Leaflet](https://react-leaflet.js.org/)
- [Guía de Tailwind CSS](https://tailwindcss.com/docs)
- [Lucide Icons Gallery](https://lucide.dev/icons/)
