import { z } from "zod";

/**
 * Normaliza un monto tipeado a mano al formato con punto decimal que espera
 * el regex de abajo. Si el usuario tipea (o pega, ej. desde "Total
 * imputado") un monto con separador de miles al estilo AR, como
 * "8.359.732,70", un reemplazo ingenuo de "," por "." lo deja en
 * "8.359.732.70" -- dos puntos, formato inválido -- aunque el valor sea
 * perfectamente correcto. Si hay coma, se la toma como separador decimal y
 * se descartan los puntos (miles); sin coma se deja como estaba, para no
 * romper el caso ambiguo de "1234.56" con punto decimal.
 */
function normalizarDecimal(v: string): string {
  return v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
}

/**
 * Campo numérico manejado como string en el front (nunca float), para que
 * coincida con las columnas numeric de Postgres. Acepta coma o punto
 * decimal y normaliza a punto antes de guardar.
 */
export const decimalOpcional = (max = "Valor inválido") =>
  z
    .string()
    .trim()
    .transform(normalizarDecimal)
    .pipe(z.string().regex(/^-?\d+(\.\d+)?$/, { error: max }))
    .optional()
    .or(z.literal("").transform(() => undefined));

/** Igual que decimalOpcional pero obligatorio (no vacío). */
export const decimalRequerido = (mensaje = "Ingresá un valor.") =>
  z
    .string()
    .trim()
    .min(1, { error: mensaje })
    .transform(normalizarDecimal)
    .pipe(z.string().regex(/^-?\d+(\.\d+)?$/, { error: "Valor inválido" }));

export const textoOpcional = z
  .string()
  .trim()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const textoRequerido = (mensaje = "Este campo es obligatorio") =>
  z.string().trim().min(1, { error: mensaje });
