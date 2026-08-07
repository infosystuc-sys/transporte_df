import { boolean, index, pgTable, text } from "drizzle-orm/pg-core";
import { accesoTotalAutenticados, fkBigint, idPk, porcentaje } from "./_helpers";
import { baseCalculoClienteEnum } from "./enums";
import { condicionesPago } from "./catalogos";

export const clientes = pgTable(
  "clientes",
  {
    id: idPk(),
    razon_social: text("razon_social").notNull(),
    nombre_fantasia: text("nombre_fantasia"),
    cuit: text("cuit"),
    condicion_iva: text("condicion_iva"),
    direccion: text("direccion"),
    localidad: text("localidad"),
    provincia: text("provincia"),
    telefono: text("telefono"),
    email: text("email"),
    contacto: text("contacto"),
    es_dador_carga: boolean("es_dador_carga").notNull().default(false),
    es_pagador_flete: boolean("es_pagador_flete").notNull().default(false),
    condicion_pago_id: fkBigint("condicion_pago_id").references(() => condicionesPago.id, {
      onDelete: "set null",
    }),
    base_calculo_flete: baseCalculoClienteEnum("base_calculo_flete").default("heredar"),
    tolerancia_merma_pct: porcentaje("tolerancia_merma_pct"),
    observaciones: text("observaciones"),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [
    accesoTotalAutenticados("clientes"),
    index("clientes_condicion_pago_id_idx").on(t.condicion_pago_id),
  ]
).enableRLS();
