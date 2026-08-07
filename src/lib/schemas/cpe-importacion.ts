import type { z } from "zod";
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
