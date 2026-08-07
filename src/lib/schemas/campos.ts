import { z } from "zod";

/**
 * Campo numérico manejado como string en el front (nunca float), para que
 * coincida con las columnas numeric de Postgres. Acepta coma o punto
 * decimal y normaliza a punto antes de guardar.
 */
export const decimalOpcional = (max = "Valor inválido") =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .pipe(z.string().regex(/^-?\d+(\.\d+)?$/, { error: max }))
    .optional()
    .or(z.literal("").transform(() => undefined));

/** Igual que decimalOpcional pero obligatorio (no vacío). */
export const decimalRequerido = (mensaje = "Ingresá un valor.") =>
  z
    .string()
    .trim()
    .min(1, { error: mensaje })
    .transform((v) => v.replace(",", "."))
    .pipe(z.string().regex(/^-?\d+(\.\d+)?$/, { error: "Valor inválido" }));

export const textoOpcional = z
  .string()
  .trim()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const textoRequerido = (mensaje = "Este campo es obligatorio") =>
  z.string().trim().min(1, { error: mensaje });
