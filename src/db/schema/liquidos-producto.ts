import { boolean, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { accesoTotalAutenticados, dinero, fkBigint, idPk, pesoKg, timestampTz } from "./_helpers";
import { clientes } from "./clientes";
import { cobros } from "./cobros";
import { viajes } from "./viajes";

/**
 * Líquido producto (comprobante ARCA cód. 060) que emite el cliente al
 * liquidar los fletes. Se carga desde Cobranzas → Cargar líquidos producto:
 * cada línea (una por Carta de Porte) se vincula sola con su viaje por el
 * CTG. Es la base del módulo de Cobranzas: se agrupa por cliente y se marca
 * como pagado (con los datos del pago, que quedan como cobros).
 */
export const liquidosProducto = pgTable(
  "liquidos_producto",
  {
    id: idPk(),
    // El emisor del LP: el cliente que paga el flete.
    cliente_id: fkBigint("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    numero: text("numero").notNull(), // "A0002-00007078"
    fecha: timestampTz("fecha").notNull(),
    cae: text("cae"),
    neto_gravado: dinero("neto_gravado").notNull(),
    iva: dinero("iva").notNull(),
    total: dinero("total").notNull(),
    /** "texto" si se leyó del PDF, "ia" si hizo falta la IA. */
    fuente: text("fuente").notNull(),
    nombre_archivo: text("nombre_archivo"),
    storage_path: text("storage_path"),
    pagado: boolean("pagado").notNull().default(false),
    fecha_pago: timestampTz("fecha_pago"),
    creado_en: timestampTz("creado_en").notNull().defaultNow(),
    actualizado_en: timestampTz("actualizado_en").notNull().defaultNow(),
  },
  (t) => [
    accesoTotalAutenticados("liquidos_producto"),
    uniqueIndex("liquidos_producto_cliente_numero_uq").on(t.cliente_id, t.numero),
  ]
).enableRLS();

/** Una línea del LP = una Carta de Porte liquidada. */
export const liquidoProductoLineas = pgTable(
  "liquido_producto_lineas",
  {
    id: idPk(),
    liquido_producto_id: fkBigint("liquido_producto_id")
      .notNull()
      .references(() => liquidosProducto.id, { onDelete: "cascade" }),
    ctg: text("ctg").notNull(),
    // null = sin vincular (la CPE no está cargada en Viajes, o es ambigua).
    // Un viaje se liquida en un solo LP: de ahí el índice único.
    viaje_id: fkBigint("viaje_id").references(() => viajes.id, { onDelete: "set null" }),
    kg: pesoKg("kg"),
    tarifa: dinero("tarifa"),
    km: integer("km"),
    flete: dinero("flete").notNull(),
    comision: dinero("comision").notNull(),
    otros_descuentos: dinero("otros_descuentos").notNull(),
    neto: dinero("neto").notNull(),
    iva: dinero("iva").notNull(),
    total: dinero("total").notNull(),
    /** Por qué quedó sin vincular, o qué se tocó del viaje al vincularlo. */
    aviso: text("aviso"),
  },
  (t) => [
    accesoTotalAutenticados("liquido_producto_lineas"),
    index("liquido_producto_lineas_lp_idx").on(t.liquido_producto_id),
    uniqueIndex("liquido_producto_lineas_viaje_uq").on(t.viaje_id),
  ]
).enableRLS();

/**
 * Los cobros con los que se pagó cada LP. Un pago puede cubrir varios LP
 * (marcado grupal) y un LP puede pagarse con varios eCheq. Al desmarcar un
 * LP como pagado se borran esos cobros.
 */
export const liquidoProductoCobros = pgTable(
  "liquido_producto_cobros",
  {
    id: idPk(),
    liquido_producto_id: fkBigint("liquido_producto_id")
      .notNull()
      .references(() => liquidosProducto.id, { onDelete: "cascade" }),
    cobro_id: fkBigint("cobro_id")
      .notNull()
      .references(() => cobros.id, { onDelete: "cascade" }),
  },
  (t) => [
    accesoTotalAutenticados("liquido_producto_cobros"),
    index("liquido_producto_cobros_lp_idx").on(t.liquido_producto_id),
    index("liquido_producto_cobros_cobro_idx").on(t.cobro_id),
  ]
).enableRLS();
