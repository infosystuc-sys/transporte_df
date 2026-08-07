import { z } from "zod";

/** Campo de fecha de un <input type="date">, opcional. */
export const fechaOpcional = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.date().optional()
);

/** Formatea una fecha guardada para precargar un <input type="date">. */
export function formatoFechaInput(fecha: Date | string | null | undefined): string {
  if (!fecha) return "";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toISOString().slice(0, 10);
}
