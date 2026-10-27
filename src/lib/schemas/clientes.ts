import { z } from "zod";
import { decimalOpcional, textoOpcional, textoRequerido } from "./campos";

export const clienteSchema = z.object({
  razon_social: textoRequerido(),
  nombre_fantasia: textoOpcional,
  cuit: textoOpcional,
  condicion_iva: textoOpcional,
  direccion: textoOpcional,
  localidad: textoOpcional,
  provincia: textoOpcional,
  telefono: textoOpcional,
  email: textoOpcional,
  contacto: textoOpcional,
  es_dador_carga: z.boolean().default(false),
  es_pagador_flete: z.boolean().default(false),
  condicion_pago_id: z.coerce.number().optional().nullable(),
  base_calculo_flete: z.enum(["origen", "destino", "heredar"]).default("heredar"),
  tolerancia_merma_pct: decimalOpcional(),
  comision_intermediario_pct_default: decimalOpcional(),
  observaciones: textoOpcional,
  activo: z.boolean().default(true),
});
export type ClienteInput = z.input<typeof clienteSchema>;

/** Solapa Comisiones: alta rápida de un cliente intermediario con su %. */
export const comisionClienteSchema = z.object({
  razon_social: textoRequerido(),
  cuit: z
    .string()
    .transform((v) => v.replace(/[^0-9]/g, ""))
    .pipe(z.string().length(11, { error: "El CUIT tiene que tener 11 dígitos." })),
  comision: decimalOpcional("Porcentaje inválido.").refine(
    (v) => v == null || (Number(v) >= 0 && Number(v) <= 100),
    { error: "El % tiene que estar entre 0 y 100." }
  ),
});
