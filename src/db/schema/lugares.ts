import {
  doublePrecision,
  index,
  pgTable,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { accesoTotalAutenticados, fkBigint, idPk } from "./_helpers";
import { tipoLugarEnum } from "./enums";
import { clientes } from "./clientes";

export const lugares = pgTable(
  "lugares",
  {
    id: idPk(),
    nombre: text("nombre").notNull(),
    tipo: tipoLugarEnum("tipo"),
    localidad: text("localidad"),
    provincia: text("provincia"),
    direccion: text("direccion"),
    n_planta: text("n_planta"),
    renspa: text("renspa"),
    latitud: doublePrecision("latitud"),
    longitud: doublePrecision("longitud"),
    cliente_id: fkBigint("cliente_id").references(() => clientes.id, {
      onDelete: "set null",
    }),
    observaciones: text("observaciones"),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [
    accesoTotalAutenticados("lugares"),
    index("lugares_cliente_id_idx").on(t.cliente_id),
  ]
).enableRLS();

/**
 * Variantes de escritura de un mismo lugar en el Excel histórico
 * ("Mojon de Fierro" / "Mijon de Fierro" / "MOJON DE FIERRO"). El buscador
 * de origen/destino matchea por nombre o por alias, sin mayúsculas ni
 * acentos.
 */
export const lugaresAlias = pgTable(
  "lugares_alias",
  {
    id: idPk(),
    lugar_id: fkBigint("lugar_id")
      .notNull()
      .references(() => lugares.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (t) => [
    accesoTotalAutenticados("lugares_alias"),
    index("lugares_alias_lugar_id_idx").on(t.lugar_id),
  ]
).enableRLS();
