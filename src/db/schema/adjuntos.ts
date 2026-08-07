import { index, pgTable, text } from "drizzle-orm/pg-core";
import { accesoTotalAutenticados, fkBigint, idPk, timestampTz } from "./_helpers";
import { entidadAdjuntoEnum, tipoAdjuntoEnum } from "./enums";

/**
 * entidad_id es polimórfico (apunta a viajes, cobros, cargas_gasoil o
 * liquidaciones_chofer según "entidad"), por eso no lleva FK de base de
 * datos — Postgres no soporta una FK condicional a distintas tablas. El
 * archivo en sí vive en Supabase Storage; storage_path es la referencia.
 */
export const adjuntos = pgTable(
  "adjuntos",
  {
    id: idPk(),
    entidad: entidadAdjuntoEnum("entidad").notNull(),
    entidad_id: fkBigint("entidad_id").notNull(),
    tipo: tipoAdjuntoEnum("tipo").notNull(),
    nombre_archivo: text("nombre_archivo"),
    storage_path: text("storage_path").notNull(),
    subido_en: timestampTz("subido_en").notNull().defaultNow(),
  },
  (t) => [
    accesoTotalAutenticados("adjuntos"),
    index("adjuntos_entidad_entidad_id_idx").on(t.entidad, t.entidad_id),
  ]
).enableRLS();
