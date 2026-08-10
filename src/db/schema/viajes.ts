import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import {
  accesoTotalAutenticados,
  dinero,
  fkBigint,
  idPk,
  pesoKg,
  porcentaje,
  timestampTz,
} from "./_helpers";
import {
  aCargoEnum,
  baseCalculoEnum,
  declaracionCalidadEnum,
  estadoViajeEnum,
  modalidadTarifaEnum,
  pagadoPorEnum,
  tipoCargaEnum,
} from "./enums";
import { clientes } from "./clientes";
import { camiones, choferes } from "./flota";
import { productos, condicionesPago, mediosPago, tiposAdicional, tiposGasto, tiposContingencia } from "./catalogos";
import { lugares } from "./lugares";
import { tarifas } from "./tarifas";

/**
 * La entidad central: un viaje = una CPE (cuando tiene_cpe). Todos los FK a
 * catálogos son opcionales salvo cliente_id, siguiendo la regla del spec de
 * no trabar la carga diaria — un viaje puede nacer "planificado" sin camión,
 * chofer, origen ni destino asignados todavía.
 */
export const viajes = pgTable(
  "viajes",
  {
    id: idPk(),
    // Correlativo interno visible, independiente del id.
    numero: integer("numero").notNull().unique().generatedAlwaysAsIdentity(),
    estado: estadoViajeEnum("estado").notNull().default("planificado"),
    tipo_carga: tipoCargaEnum("tipo_carga").notNull().default("grano"),
    tiene_cpe: boolean("tiene_cpe").notNull().default(true),

    // Documentación
    cpe_nro: text("cpe_nro"),
    ctg: text("ctg"),
    cpe_fecha_emision: timestampTz("cpe_fecha_emision"),
    ctg_vencimiento: timestampTz("ctg_vencimiento"),
    campania: text("campania"),
    remito_nro: text("remito_nro"),
    declaracion_calidad: declaracionCalidadEnum("declaracion_calidad"),

    // Partes intervinientes. El cliente es siempre el flete pagador: es a
    // quien se le factura, y es el único de la CPE que se da de alta en el
    // catálogo de clientes. No hay un campo de pagador aparte a propósito:
    // por definición del negocio nunca difiere del cliente, y tenerlo
    // suelto solo habilitaba que los dos quedaran en desacuerdo.
    cliente_id: fkBigint("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    // Titular de la carta de porte y destinatario de la mercadería: se
    // guardan como texto, solo con fines estadísticos. No son clientes
    // (no se les factura), así que no se les crea ficha en el catálogo.
    titular_nombre: text("titular_nombre"),
    titular_cuit: text("titular_cuit"),
    destinatario_nombre: text("destinatario_nombre"),
    destinatario_cuit: text("destinatario_cuit"),
    intermediario_id: fkBigint("intermediario_id").references(() => clientes.id, {
      onDelete: "set null",
    }),
    comision_intermediario_pct: porcentaje("comision_intermediario_pct"),

    // Transporte
    camion_id: fkBigint("camion_id").references(() => camiones.id, { onDelete: "set null" }),
    chofer_id: fkBigint("chofer_id").references(() => choferes.id, { onDelete: "set null" }),
    // Snapshot en texto al momento del viaje: un cambio futuro en el camión
    // no debe alterar el histórico.
    dominio_tractor: text("dominio_tractor"),
    dominio_acoplado: text("dominio_acoplado"),
    producto_id: fkBigint("producto_id").references(() => productos.id, {
      onDelete: "set null",
    }),
    origen_id: fkBigint("origen_id").references(() => lugares.id, { onDelete: "set null" }),
    destino_id: fkBigint("destino_id").references(() => lugares.id, { onDelete: "set null" }),
    km: integer("km"),

    // Fechas
    fecha_carga: timestampTz("fecha_carga"),
    fecha_partida: timestampTz("fecha_partida"),
    fecha_arribo: timestampTz("fecha_arribo"),
    fecha_descarga: timestampTz("fecha_descarga"),
    n_turno_descarga: text("n_turno_descarga"),

    // Pesos (kg)
    bruto_origen: pesoKg("bruto_origen"),
    tara_origen: pesoKg("tara_origen"),
    neto_origen: pesoKg("neto_origen"),
    bruto_destino: pesoKg("bruto_destino"),
    tara_destino: pesoKg("tara_destino"),
    neto_destino: pesoKg("neto_destino"),
    merma_kg: pesoKg("merma_kg"),
    merma_pct: porcentaje("merma_pct"),
    // Snapshot de la tolerancia vigente al momento del cálculo.
    tolerancia_pct_aplicada: porcentaje("tolerancia_pct_aplicada"),
    merma_excede_tolerancia: boolean("merma_excede_tolerancia").notNull().default(false),
    merma_precio_unitario: dinero("merma_precio_unitario"),
    merma_importe: dinero("merma_importe"),

    // Tarifa e importes
    modalidad_tarifa: modalidadTarifaEnum("modalidad_tarifa"),
    valor_tarifa: dinero("valor_tarifa"),
    tarifa_id: fkBigint("tarifa_id").references(() => tarifas.id, { onDelete: "set null" }),
    base_calculo: baseCalculoEnum("base_calculo"),
    importe_flete: dinero("importe_flete"),
    importe_adicionales: dinero("importe_adicionales"),
    importe_comision: dinero("importe_comision"),
    total_a_cobrar: dinero("total_a_cobrar"),

    // Facturación y cobro (la factura se emite en Sinagro, acá solo se registra)
    facturado: boolean("facturado").notNull().default(false),
    factura_nro: text("factura_nro"),
    factura_fecha: timestampTz("factura_fecha"),
    factura_importe_neto: dinero("factura_importe_neto"),
    factura_iva: dinero("factura_iva"),
    factura_importe_total: dinero("factura_importe_total"),
    condicion_pago_id: fkBigint("condicion_pago_id").references(() => condicionesPago.id, {
      onDelete: "set null",
    }),
    fecha_vto_cobro: timestampTz("fecha_vto_cobro"),
    importe_cobrado: dinero("importe_cobrado"),
    saldo_pendiente: dinero("saldo_pendiente"),

    // Liquidación al chofer. Sin FK dura a liquidaciones_chofer para evitar
    // una dependencia circular entre módulos — el vínculo formal N:M vive
    // en liquidacion_viajes (ver choferes-cuenta.ts).
    liquidado: boolean("liquidado").notNull().default(false),
    liquidacion_id: fkBigint("liquidacion_id"),
    importe_liquidacion_chofer: dinero("importe_liquidacion_chofer"),

    // Preparado para contrafletes/retorno — sin funcionalidad todavía.
    viaje_relacionado_id: fkBigint("viaje_relacionado_id"),

    observaciones: text("observaciones"),
    // Marca los viajes cargados por el importador de Excel (Fase 13) para
    // no mezclarlos con la operación nueva.
    importado_de_excel: boolean("importado_de_excel").notNull().default(false),

    creado_en: timestampTz("creado_en").notNull().defaultNow(),
    actualizado_en: timestampTz("actualizado_en").notNull().defaultNow(),
  },
  (t) => [
    accesoTotalAutenticados("viajes"),
    index("viajes_cliente_id_idx").on(t.cliente_id),
    index("viajes_intermediario_id_idx").on(t.intermediario_id),
    index("viajes_camion_id_idx").on(t.camion_id),
    index("viajes_chofer_id_idx").on(t.chofer_id),
    index("viajes_producto_id_idx").on(t.producto_id),
    index("viajes_origen_id_idx").on(t.origen_id),
    index("viajes_destino_id_idx").on(t.destino_id),
    index("viajes_tarifa_id_idx").on(t.tarifa_id),
    index("viajes_condicion_pago_id_idx").on(t.condicion_pago_id),
    index("viajes_liquidacion_id_idx").on(t.liquidacion_id),
    index("viajes_estado_idx").on(t.estado),
  ]
).enableRLS();

export const viajeAdicionales = pgTable(
  "viaje_adicionales",
  {
    id: idPk(),
    viaje_id: fkBigint("viaje_id")
      .notNull()
      .references(() => viajes.id, { onDelete: "cascade" }),
    tipo_adicional_id: fkBigint("tipo_adicional_id")
      .notNull()
      .references(() => tiposAdicional.id, { onDelete: "restrict" }),
    descripcion: text("descripcion"),
    importe: dinero("importe").notNull(),
    a_cargo_de: aCargoEnum("a_cargo_de"),
  },
  (t) => [
    accesoTotalAutenticados("viaje_adicionales"),
    index("viaje_adicionales_viaje_id_idx").on(t.viaje_id),
    index("viaje_adicionales_tipo_adicional_id_idx").on(t.tipo_adicional_id),
  ]
).enableRLS();

export const viajeContingencias = pgTable(
  "viaje_contingencias",
  {
    id: idPk(),
    viaje_id: fkBigint("viaje_id")
      .notNull()
      .references(() => viajes.id, { onDelete: "cascade" }),
    tipo_contingencia_id: fkBigint("tipo_contingencia_id").references(
      () => tiposContingencia.id,
      { onDelete: "set null" }
    ),
    descripcion: text("descripcion"),
    fecha: timestampTz("fecha"),
    es_desactivacion: boolean("es_desactivacion").notNull().default(false),
  },
  (t) => [
    accesoTotalAutenticados("viaje_contingencias"),
    index("viaje_contingencias_viaje_id_idx").on(t.viaje_id),
    index("viaje_contingencias_tipo_contingencia_id_idx").on(t.tipo_contingencia_id),
  ]
).enableRLS();

export const viajeGastos = pgTable(
  "viaje_gastos",
  {
    id: idPk(),
    viaje_id: fkBigint("viaje_id")
      .notNull()
      .references(() => viajes.id, { onDelete: "cascade" }),
    tipo_gasto_id: fkBigint("tipo_gasto_id")
      .notNull()
      .references(() => tiposGasto.id, { onDelete: "restrict" }),
    fecha: timestampTz("fecha"),
    importe: dinero("importe").notNull(),
    pagado_por: pagadoPorEnum("pagado_por"),
    medio_pago_id: fkBigint("medio_pago_id").references(() => mediosPago.id, {
      onDelete: "set null",
    }),
    comprobante_nro: text("comprobante_nro"),
    // Si pagado_por = chofer y rendido = false, genera un movimiento a
    // favor del chofer en su cuenta corriente (Fase 8).
    rendido: boolean("rendido").notNull().default(false),
    observaciones: text("observaciones"),
  },
  (t) => [
    accesoTotalAutenticados("viaje_gastos"),
    index("viaje_gastos_viaje_id_idx").on(t.viaje_id),
    index("viaje_gastos_tipo_gasto_id_idx").on(t.tipo_gasto_id),
    index("viaje_gastos_medio_pago_id_idx").on(t.medio_pago_id),
  ]
).enableRLS();
