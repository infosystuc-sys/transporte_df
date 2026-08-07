import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { accesoTotalAutenticados, dinero, fkBigint, idPk, timestampTz } from "./_helpers";
import { tipoMovimientoChoferEnum } from "./enums";
import { choferes } from "./flota";
import { mediosPago } from "./catalogos";
import { viajes } from "./viajes";

/**
 * Libro mayor del chofer. El signo (a favor/en contra del saldo) se deriva
 * del tipo en la capa de aplicación, no se guarda como columna:
 * adelanto/gasoil/ajuste restan, liquidacion/gasto_rendido suman.
 */
export const movimientosChofer = pgTable(
  "movimientos_chofer",
  {
    id: idPk(),
    fecha: timestampTz("fecha").notNull(),
    chofer_id: fkBigint("chofer_id")
      .notNull()
      .references(() => choferes.id, { onDelete: "restrict" }),
    tipo: tipoMovimientoChoferEnum("tipo").notNull(),
    medio_pago_id: fkBigint("medio_pago_id").references(() => mediosPago.id, {
      onDelete: "set null",
    }),
    importe: dinero("importe").notNull(),
    viaje_id: fkBigint("viaje_id").references(() => viajes.id, { onDelete: "set null" }),
    // true cuando lo generó el sistema (ej. desde un gasto o carga de gasoil).
    origen_automatico: boolean("origen_automatico").notNull().default(false),
    descripcion: text("descripcion"),
    // Marca el movimiento como ya "barrido" por una liquidación (spec 11):
    // el saldo pendiente de la cuenta corriente solo suma los que siguen
    // en null. Se completa recién al crear la liquidación, nunca antes.
    liquidacion_id: fkBigint("liquidacion_id").references(() => liquidacionesChofer.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    accesoTotalAutenticados("movimientos_chofer"),
    index("movimientos_chofer_chofer_id_idx").on(t.chofer_id),
    index("movimientos_chofer_medio_pago_id_idx").on(t.medio_pago_id),
    index("movimientos_chofer_viaje_id_idx").on(t.viaje_id),
    index("movimientos_chofer_liquidacion_id_idx").on(t.liquidacion_id),
  ]
).enableRLS();

/** Se cierra por mes y por chofer, como lo totalizan hoy en el Excel. */
export const liquidacionesChofer = pgTable(
  "liquidaciones_chofer",
  {
    id: idPk(),
    chofer_id: fkBigint("chofer_id")
      .notNull()
      .references(() => choferes.id, { onDelete: "restrict" }),
    periodo_desde: timestampTz("periodo_desde"),
    periodo_hasta: timestampTz("periodo_hasta"),
    fecha: timestampTz("fecha").notNull(),
    total_viajes: integer("total_viajes"),
    total_adelantos: dinero("total_adelantos"),
    total_neto: dinero("total_neto"),
    pagado: boolean("pagado").notNull().default(false),
    medio_pago_id: fkBigint("medio_pago_id").references(() => mediosPago.id, {
      onDelete: "set null",
    }),
    observaciones: text("observaciones"),
  },
  (t) => [
    accesoTotalAutenticados("liquidaciones_chofer"),
    index("liquidaciones_chofer_chofer_id_idx").on(t.chofer_id),
    index("liquidaciones_chofer_medio_pago_id_idx").on(t.medio_pago_id),
  ]
).enableRLS();

/** Detalle N:M de qué viajes entran en cada liquidación. */
export const liquidacionViajes = pgTable(
  "liquidacion_viajes",
  {
    id: idPk(),
    liquidacion_id: fkBigint("liquidacion_id")
      .notNull()
      .references(() => liquidacionesChofer.id, { onDelete: "cascade" }),
    viaje_id: fkBigint("viaje_id")
      .notNull()
      .references(() => viajes.id, { onDelete: "restrict" }),
    importe: dinero("importe"),
  },
  (t) => [
    accesoTotalAutenticados("liquidacion_viajes"),
    index("liquidacion_viajes_liquidacion_id_idx").on(t.liquidacion_id),
    index("liquidacion_viajes_viaje_id_idx").on(t.viaje_id),
  ]
).enableRLS();
