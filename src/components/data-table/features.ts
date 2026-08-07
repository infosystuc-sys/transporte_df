import { tableFeatures } from "@tanstack/react-table";

/**
 * Instancia compartida de features de TanStack Table v9. La app no usa las
 * funciones de sorting/paginación/filtrado propias de la librería: eso se
 * resuelve del lado del servidor (query params + Drizzle). Solo se usa
 * TanStack para el modelo de filas/columnas headless.
 */
export const tableFeaturesBase = tableFeatures({});
