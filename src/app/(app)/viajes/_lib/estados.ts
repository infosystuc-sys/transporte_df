export const ESTADOS_ORDEN = [
  "planificado",
  "cargado",
  "en_transito",
  "descargado",
  "facturado",
  "cobrado",
  "liquidado",
] as const;

// "rechazado" es un estado terminal alternativo, no un paso de la
// secuencia — a propósito no está en ESTADOS_ORDEN ni en el stepper
// lineal, pero sí es un valor válido de la columna estado.
export type EstadoViaje = (typeof ESTADOS_ORDEN)[number] | "rechazado";
