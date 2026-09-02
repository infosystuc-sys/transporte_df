import { z } from "zod";

/** Campo de fecha de un <input type="date">, opcional. */
export const fechaOpcional = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.date().optional()
);

/** Campo de fecha de un <input type="date">, obligatorio. */
export const fechaRequerida = (mensaje = "Ingresá una fecha.") =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date({ error: mensaje }));

/** Formatea una fecha guardada para precargar un <input type="date">. */
export function formatoFechaInput(fecha: Date | string | null | undefined): string {
  if (!fecha) return "";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  // Una extracción de IA puede devolver un string que no parsea a fecha válida.
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
