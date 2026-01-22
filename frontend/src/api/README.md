# API Client

Capa de comunicación con el Backend.

## Generación de Código
Este cliente se genera automáticamente a partir de la especificación OpenAPI del backend (`openapi.json`).
Esto asegura que el Frontend siempre esté sincronizado con la definición de la API del Backend.

### Comando de Actualización
```bash
npm run generate-api
```
Este script utiliza `openapi-typescript-codegen` para regenerar los servicios y modelos.

## Estructura
*   **`generated/`**: Código autogenerado (No editar manualmente).
    *   `core/`: Configuración base de requests.
    *   `models/`: Interfaces TypeScript.
    *   `services/`: Métodos para llamar a endpoints.
