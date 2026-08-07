import { z } from "zod";
import { decimalOpcional, textoOpcional } from "./campos";
import { fechaOpcional } from "./campos-fecha";

const idOpcional = z.coerce.number().optional().nullable();

export const viajeDatosGeneralesSchema = z.object({
  tiene_cpe: z.boolean().default(true),
  tipo_carga: z.enum(["grano", "otro"]).default("grano"),
  cpe_nro: textoOpcional,
  ctg: textoOpcional,
  cpe_fecha_emision: fechaOpcional,
  ctg_vencimiento: fechaOpcional,
  campania: textoOpcional,
  declaracion_calidad: z.enum(["conforme", "condicional"]).optional().nullable(),
  remito_nro: textoOpcional,

  cliente_id: z.coerce.number({ error: "Elegí un cliente." }),
  pagador_id: idOpcional,
  destinatario_id: idOpcional,
  intermediario_id: idOpcional,
  comision_intermediario_pct: decimalOpcional(),

  camion_id: idOpcional,
  chofer_id: idOpcional,
  dominio_tractor: textoOpcional,
  dominio_acoplado: textoOpcional,
  producto_id: idOpcional,
  origen_id: idOpcional,
  destino_id: idOpcional,
  km: z.coerce.number().int().optional().nullable(),

  observaciones: textoOpcional,
});
export type ViajeDatosGeneralesInput = z.input<typeof viajeDatosGeneralesSchema>;

export const viajeCargaSchema = z.object({
  fecha_carga: fechaOpcional,
  fecha_partida: fechaOpcional,
  bruto_origen: decimalOpcional(),
  tara_origen: decimalOpcional(),
  neto_origen: decimalOpcional(),
});
export type ViajeCargaInput = z.input<typeof viajeCargaSchema>;

export const viajeDescargaSchema = z.object({
  fecha_arribo: fechaOpcional,
  fecha_descarga: fechaOpcional,
  n_turno_descarga: textoOpcional,
  bruto_destino: decimalOpcional(),
  tara_destino: decimalOpcional(),
  neto_destino: decimalOpcional(),
  // Precio para valorizar la merma. Se precarga con el precio de referencia
  // del producto si no se cargó nada, pero siempre es editable.
  merma_precio_unitario: decimalOpcional(),
});
export type ViajeDescargaInput = z.input<typeof viajeDescargaSchema>;

export const viajeTarifaSchema = z.object({
  modalidad_tarifa: z
    .enum(["por_tonelada", "por_km", "por_tonelada_km", "monto_fijo"])
    .optional()
    .nullable(),
  valor_tarifa: decimalOpcional(),
  base_calculo: z.enum(["origen", "destino"]).optional().nullable(),
});
export type ViajeTarifaInput = z.input<typeof viajeTarifaSchema>;

export const viajeContingenciaSchema = z.object({
  tipo_contingencia_id: idOpcional,
  descripcion: textoOpcional,
  fecha: fechaOpcional,
  es_desactivacion: z.boolean().default(false),
});
export type ViajeContingenciaInput = z.input<typeof viajeContingenciaSchema>;
