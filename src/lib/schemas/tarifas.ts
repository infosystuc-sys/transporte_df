import { z } from "zod";
import { decimalRequerido, textoOpcional } from "./campos";
import { fechaOpcional, fechaRequerida } from "./campos-fecha";

export const tarifaSchema = z.object({
  cliente_id: z.coerce.number({ error: "Elegí un cliente." }),
  origen_id: z.coerce.number().optional().nullable(),
  destino_id: z.coerce.number().optional().nullable(),
  // vacío = aplica a cualquier producto
  producto_id: z.coerce.number().optional().nullable(),
  km: z.coerce.number().int().optional().nullable(),
  modalidad_tarifa: z
    .enum(["por_tonelada", "por_km", "por_tonelada_km", "monto_fijo"])
    .optional()
    .nullable(),
  valor: decimalRequerido(),
  vigencia_desde: fechaRequerida(),
  vigencia_hasta: fechaOpcional,
  activo: z.boolean().default(true),
  observaciones: textoOpcional,
});
export type TarifaInput = z.input<typeof tarifaSchema>;
