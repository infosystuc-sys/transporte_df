import { z } from "zod";

const filaImportarSchema = z.object({
  fecha_carga: z.string().optional().nullable(),
  ctg: z.string().optional().nullable(),
  cliente_id: z.coerce.number({ error: "Falta el cliente." }),
  producto_id: z.coerce.number().optional().nullable(),
  origen_id: z.coerce.number().optional().nullable(),
  destino_id: z.coerce.number().optional().nullable(),
  camion_id: z.coerce.number().optional().nullable(),
  chofer_id: z.coerce.number().optional().nullable(),
  valor_tarifa: z.number().optional().nullable(),
  tn_origen: z.number().optional().nullable(),
  tn_destino: z.number().optional().nullable(),
  importe_liquidacion_chofer: z.number().optional().nullable(),
  estado: z
    .enum(["planificado", "cargado", "en_transito", "descargado", "facturado", "cobrado", "liquidado"])
    .default("descargado"),
});

export const confirmarImportacionHistoricaSchema = z.object({
  filas: z.array(filaImportarSchema).min(1, "No hay filas para importar."),
});
export type ConfirmarImportacionHistoricaInput = z.input<typeof confirmarImportacionHistoricaSchema>;
