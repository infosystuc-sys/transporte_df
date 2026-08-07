import { z } from "zod";
import { decimalOpcional, textoOpcional, textoRequerido } from "./campos";

export const condicionPagoSchema = z.object({
  nombre: textoRequerido(),
  dias: z.coerce.number().int().optional().nullable(),
  observaciones: textoOpcional,
});
export type CondicionPagoInput = z.input<typeof condicionPagoSchema>;

export const medioPagoSchema = z.object({
  nombre: textoRequerido(),
  requiere_datos_cheque: z.boolean().default(false),
  activo: z.boolean().default(true),
});
export type MedioPagoInput = z.input<typeof medioPagoSchema>;

const aCargoEnumSchema = z.enum(["cliente", "empresa"]).optional().nullable();

export const tipoAdicionalSchema = z.object({
  nombre: textoRequerido(),
  a_cargo_default: aCargoEnumSchema,
  activo: z.boolean().default(true),
});
export type TipoAdicionalInput = z.input<typeof tipoAdicionalSchema>;

export const tipoGastoSchema = z.object({
  nombre: textoRequerido(),
  activo: z.boolean().default(true),
});
export type TipoGastoInput = z.input<typeof tipoGastoSchema>;

export const tipoContingenciaSchema = z.object({
  nombre: textoRequerido(),
  activo: z.boolean().default(true),
});
export type TipoContingenciaInput = z.input<typeof tipoContingenciaSchema>;

export const estacionServicioSchema = z.object({
  nombre: textoRequerido(),
  localidad: textoOpcional,
  provincia: textoOpcional,
  tiene_cuenta_corriente: z.boolean().default(false),
  observaciones: textoOpcional,
  activo: z.boolean().default(true),
});
export type EstacionServicioInput = z.input<typeof estacionServicioSchema>;

export const productoSchema = z.object({
  nombre: textoRequerido(),
  tipo: z.enum(["grano", "fertilizante", "otro"]).optional().nullable(),
  precio_referencia: decimalOpcional(),
  activo: z.boolean().default(true),
});
export type ProductoInput = z.input<typeof productoSchema>;
