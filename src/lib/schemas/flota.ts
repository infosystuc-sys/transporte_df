import { z } from "zod";
import { decimalOpcional, textoOpcional, textoRequerido } from "./campos";
import { fechaOpcional } from "./campos-fecha";

export const camionSchema = z.object({
  dominio_tractor: textoRequerido(),
  dominio_acoplado: textoOpcional,
  marca: textoOpcional,
  modelo: textoOpcional,
  anio: z.coerce.number().int().optional().nullable(),
  n_chasis: textoOpcional,
  n_motor: textoOpcional,
  titular: textoOpcional,
  tara_kg: z.coerce.number().int().optional().nullable(),
  capacidad_kg: z.coerce.number().int().optional().nullable(),
  vto_vtv: fechaOpcional,
  vto_seguro: fechaOpcional,
  aseguradora: textoOpcional,
  poliza: textoOpcional,
  vto_ruta: fechaOpcional,
  vto_cnrt: fechaOpcional,
  vto_senasa: fechaOpcional,
  odometro_actual: z.coerce.number().int().optional().nullable(),
  observaciones: textoOpcional,
  activo: z.boolean().default(true),
});
export type CamionInput = z.input<typeof camionSchema>;

export const choferSchema = z.object({
  nombre_completo: textoRequerido(),
  cuil: textoOpcional,
  dni: textoOpcional,
  telefono: textoOpcional,
  email: textoOpcional,
  direccion: textoOpcional,
  localidad: textoOpcional,
  licencia_nro: textoOpcional,
  licencia_vto: fechaOpcional,
  linti_vto: fechaOpcional,
  modalidad_pago: z
    .enum(["porcentaje_flete", "monto_fijo_viaje", "por_tonelada", "sueldo", "sin_definir"])
    .default("porcentaje_flete"),
  valor_pago: decimalOpcional().default("15"),
  camion_habitual_id: z.coerce.number().optional().nullable(),
  observaciones: textoOpcional,
  activo: z.boolean().default(true),
});
export type ChoferInput = z.input<typeof choferSchema>;
