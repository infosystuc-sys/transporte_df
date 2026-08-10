import { z } from "zod";
import {
  viajeCargaSchema,
  viajeDatosGeneralesSchema,
  viajeDescargaSchema,
  viajeTarifaSchema,
} from "./viajes";

/**
 * Un viaje creado desde una CPE importada carga de una sola vez los campos
 * que normalmente se completan en 4 pestañas separadas (generales, carga,
 * descarga, tarifa) — la CPE ya trae todo eso junto. Los shapes no se
 * pisan entre sí (se verificó campo por campo contra viajes.ts).
 */
export const viajeDesdeCpeSchema = viajeDatosGeneralesSchema
  .extend(viajeCargaSchema.shape)
  .extend(viajeDescargaSchema.shape)
  .extend(viajeTarifaSchema.shape);

export type ViajeDesdeCpeInput = z.input<typeof viajeDesdeCpeSchema>;

/**
 * Entidad faltante que la pantalla de revisión manda al servidor para dar
 * de alta. Se valida acá porque llega del cliente: los nombres salen de un
 * PDF parseado (o leído por IA), no de un catálogo confiable.
 */
export const entidadFaltanteSchema = z.object({
  clave: z.string().min(1),
  tipo: z.enum(["cliente", "chofer", "camion", "producto", "lugar"]),
  campo: z.enum([
    "cliente_id",
    "chofer_id",
    "camion_id",
    "producto_id",
    "origen_id",
    "destino_id",
  ]),
  etiqueta: z.string(),
  nombre: z.string().trim().min(1, "El nombre no puede quedar vacío."),
  documento: z.string().nullable(),
});

export const crearFaltantesSchema = z.object({
  faltantes: z.array(entidadFaltanteSchema).min(1, "No hay nada que dar de alta."),
});
export type CrearFaltantesInput = z.input<typeof crearFaltantesSchema>;
