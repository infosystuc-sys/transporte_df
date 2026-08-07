import { z } from "zod";
import { decimalOpcional, textoOpcional } from "./campos";

export const configuracionSchema = z.object({
  razon_social: textoOpcional,
  cuit: textoOpcional,
  direccion: textoOpcional,
  telefono: textoOpcional,
  email: textoOpcional,
  tolerancia_merma_pct: decimalOpcional(),
  base_calculo_flete_default: z.enum(["origen", "destino"]).optional().nullable(),
  modalidad_tarifa_default: z
    .enum(["por_tonelada", "por_km", "por_tonelada_km", "monto_fijo"])
    .optional()
    .nullable(),
  unidad_carga_default: z.enum(["toneladas", "kilogramos"]).optional().nullable(),
  porcentaje_chofer_default: decimalOpcional(),
  alerta_ctg_horas: z.coerce.number().int().optional().nullable(),
  alerta_vencimientos_dias: z.coerce.number().int().optional().nullable(),
});
export type ConfiguracionInput = z.input<typeof configuracionSchema>;
