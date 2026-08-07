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
  observaciones: textoOpcional,
  activo: z.boolean().default(true),
});
export type ClienteInput = z.input<typeof clienteSchema>;
