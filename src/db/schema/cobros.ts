import { index, pgTable, text } from "drizzle-orm/pg-core";
import { accesoTotalAutenticados, dinero, fkBigint, idPk, timestampTz } from "./_helpers";
import { tipoRetencionEnum } from "./enums";
import { clientes } from "./clientes";
import { mediosPago } from "./catalogos";
import { viajes } from "./viajes";

export const cobros = pgTable(
  "cobros",
  {
    id: idPk(),
    fecha: timestampTz("fecha").notNull(),
    // El pagador del flete, no necesariamente el titular de la CPE.
    cliente_id: fkBigint("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    medio_pago_id: fkBigint("medio_pago_id")
      .notNull()
      .references(() => mediosPago.id, { onDelete: "restrict" }),
    importe: dinero("importe").notNull(),
    referencia: text("referencia"),
    banco: text("banco"),
    cheque_nro: text("cheque_nro"),
    cheque_vto: timestampTz("cheque_vto"),
    observaciones: text("observaciones"),
  },
  (t) => [
    accesoTotalAutenticados("cobros"),
    index("cobros_cliente_id_idx").on(t.cliente_id),
    index("cobros_medio_pago_id_idx").on(t.medio_pago_id),
  ]
).enableRLS();

/** Un cobro puede cubrir varios viajes y un viaje puede cobrarse en varios pagos. */
export const cobroImputaciones = pgTable(
  "cobro_imputaciones",
  {
    id: idPk(),
    cobro_id: fkBigint("cobro_id")
      .notNull()
      .references(() => cobros.id, { onDelete: "cascade" }),
    viaje_id: fkBigint("viaje_id")
      .notNull()
      .references(() => viajes.id, { onDelete: "restrict" }),
    importe_imputado: dinero("importe_imputado").notNull(),
  },
  (t) => [
    accesoTotalAutenticados("cobro_imputaciones"),
    index("cobro_imputaciones_cobro_id_idx").on(t.cobro_id),
    index("cobro_imputaciones_viaje_id_idx").on(t.viaje_id),
  ]
).enableRLS();

export const retencionesCobro = pgTable(
  "retenciones_cobro",
  {
    id: idPk(),
    cobro_id: fkBigint("cobro_id")
      .notNull()
      .references(() => cobros.id, { onDelete: "cascade" }),
    tipo: tipoRetencionEnum("tipo").notNull(),
    importe: dinero("importe").notNull(),
    certificado_nro: text("certificado_nro"),
  },
  (t) => [
    accesoTotalAutenticados("retenciones_cobro"),
    index("retenciones_cobro_cobro_id_idx").on(t.cobro_id),
  ]
).enableRLS();
