import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { accesoTotalAutenticados, dinero, fkBigint, idPk, timestampTz } from "./_helpers";
import { modalidadTarifaEnum } from "./enums";
import { clientes } from "./clientes";
import { lugares } from "./lugares";
import { productos } from "./catalogos";

export const tarifas = pgTable(
  "tarifas",
  {
    id: idPk(),
    cliente_id: fkBigint("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    origen_id: fkBigint("origen_id").references(() => lugares.id, { onDelete: "set null" }),
    destino_id: fkBigint("destino_id").references(() => lugares.id, {
      onDelete: "set null",
    }),
    // vacío = aplica a cualquier producto
    producto_id: fkBigint("producto_id").references(() => productos.id, {
      onDelete: "set null",
    }),
    km: integer("km"),
    modalidad_tarifa: modalidadTarifaEnum("modalidad_tarifa"),
    valor: dinero("valor").notNull(),
    vigencia_desde: timestampTz("vigencia_desde").notNull(),
    // nulo = vigente
    vigencia_hasta: timestampTz("vigencia_hasta"),
    activo: boolean("activo").notNull().default(true),
    observaciones: text("observaciones"),
  },
  (t) => [
    accesoTotalAutenticados("tarifas"),
    index("tarifas_cliente_id_idx").on(t.cliente_id),
    index("tarifas_origen_id_idx").on(t.origen_id),
    index("tarifas_destino_id_idx").on(t.destino_id),
    index("tarifas_producto_id_idx").on(t.producto_id),
  ]
).enableRLS();
