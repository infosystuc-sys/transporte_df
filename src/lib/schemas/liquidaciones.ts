import { z } from "zod";
import { decimalRequerido, textoOpcional } from "./campos";
import { fechaOpcional, fechaRequerida } from "./campos-fecha";

export const liquidacionCabeceraSchema = z.object({
  chofer_id: z.coerce.number({ error: "Elegí el chofer." }),
  fecha: fechaRequerida(),
  periodo_desde: fechaOpcional,
  periodo_hasta: fechaOpcional,
  medio_pago_id: z.coerce.number().optional().nullable(),
  observaciones: textoOpcional,
});
export type LiquidacionCabeceraInput = z.input<typeof liquidacionCabeceraSchema>;

const liquidacionViajeSchema = z.object({
  viaje_id: z.number(),
  importe: decimalRequerido(),
});

const liquidacionMovimientoSchema = z.object({
  movimiento_id: z.number(),
});

export const crearLiquidacionSchema = z.object({
  cabecera: liquidacionCabeceraSchema,
  viajes: z.array(liquidacionViajeSchema).default([]),
  movimientos: z.array(liquidacionMovimientoSchema).default([]),
});
export type CrearLiquidacionInput = z.input<typeof crearLiquidacionSchema>;
