export const ESTADOS_ORDEN = [
  "planificado",
  "cargado",
  "en_transito",
  "descargado",
  "facturado",
  "cobrado",
  "liquidado",
] as const;

export type EstadoViaje = (typeof ESTADOS_ORDEN)[number];
