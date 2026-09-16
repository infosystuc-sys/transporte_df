import { z } from "zod";

/**
 * Normaliza un monto tipeado a mano al formato con punto decimal que espera
 * el regex de abajo. Si el usuario tipea (o pega, ej. desde "Total
 * imputado") un monto con separador de miles al estilo AR, como
 * "8.359.732,70", un reemplazo ingenuo de "," por "." lo deja en
 * "8.359.732.70" -- dos puntos, formato inválido -- aunque el valor sea
 * perfectamente correcto. Si hay coma, se la toma como separador decimal y
 * se descartan los puntos (miles).
 *
 * Sin coma, un monto redondo también puede venir con puntos de miles y
 * nada de decimales (ej. "8.000.000") -- ahí no hay ambigüedad posible en
 * cuanto aparece MÁS DE UN punto: ningún número decimal válido tiene dos
 * puntos, así que tienen que ser separadores de miles y se pueden sacar
 * con seguridad. Un solo punto sigue siendo ambiguo ("1234.56" decimal vs.
 * "1.234" con separador de miles) y se deja tal cual, como antes.
 */
function normalizarDecimal(v: string): string {
  if (v.includes(",")) return v.replace(/\./g, "").replace(",", ".");
  const puntos = (v.match(/\./g) ?? []).length;
  return puntos > 1 ? v.replace(/\./g, "") : v;
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
