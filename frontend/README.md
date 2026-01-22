# TuDestri Frontend

This directory contains the React-based Single Page Application (SPA) for TuDestri.

## Tech Stack

- **Framework**: React + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Leaflet / React-Leaflet
- **State Management**: Zustand
- **Charts**: Recharts
- **API Client**: Axios (with generated types)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

### Development Scripts

- `npm run dev`: Start the development server (default port 5173).
- `npm run build`: Build the application for production.
- `npm run lint`: Run ESLint.
- `npm run preview`: Preview the production build locally.
- `npm run check`: Run TypeScript type checking.
- `npm run generate-api`: Regenerate API client code from the backend OpenAPI spec (requires backend running).

## Project Structure

- `src/`
  - `api/`: Generated API client and models.
  - `components/`: Reusable UI components (Map, Dashboard, etc.).
  - `hooks/`: Custom React hooks (e.g., `useSimulationController`).
  - `pages/`: Main application views.
  - `services/`: API service configuration.
  - `store/`: Zustand state stores.
  - `utils/`: Helper functions.
  - `App.tsx`: Main application component.

## Testing

- **Unit Tests**: `npm run test` (if configured with Vitest) or check `src/__tests__`.
- **E2E Tests**: See `tests/e2e/` (Playwright).

## Configuration

Environment variables can be configured in `.env` files (e.g., `.env.local`).
See `vite.config.ts` for build configuration.
