import { z } from "zod";
import { decimalRequerido, textoOpcional } from "./campos";
import { fechaOpcional, fechaRequerida } from "./campos-fecha";

export const cobroCabeceraSchema = z.object({
  fecha: fechaRequerida(),
  cliente_id: z.coerce.number({ error: "Elegí el cliente pagador." }),
  medio_pago_id: z.coerce.number({ error: "Elegí un medio de pago." }),
  importe: decimalRequerido(),
  referencia: textoOpcional,
  banco: textoOpcional,
  cheque_nro: textoOpcional,
  cheque_vto: fechaOpcional,
  observaciones: textoOpcional,
});
export type CobroCabeceraInput = z.input<typeof cobroCabeceraSchema>;

export const imputacionSchema = z.object({
  viaje_id: z.number(),
  importe_imputado: decimalRequerido(),
});

export const retencionSchema = z.object({
  tipo: z.enum(["ganancias", "iibb", "iva", "sicore", "otro"], { error: "Elegí un tipo." }),
  importe: decimalRequerido(),
  certificado_nro: textoOpcional,
});
export type RetencionInput = z.input<typeof retencionSchema>;

export const crearCobroSchema = z.object({
  cabecera: cobroCabeceraSchema,
  imputaciones: z.array(imputacionSchema).min(0),
  retenciones: z.array(retencionSchema).default([]),
});
export type CrearCobroInput = z.input<typeof crearCobroSchema>;
