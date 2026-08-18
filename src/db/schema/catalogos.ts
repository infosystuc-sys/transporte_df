import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import {
  accesoTotalAutenticados,
  dinero,
  idPk,
  porcentaje,
} from "./_helpers";
import {
  aCargoEnum,
  baseCalculoEnum,
  modalidadTarifaEnum,
  tipoProductoEnum,
  unidadCargaEnum,
} from "./enums";

/** Fila única con los datos de la empresa y los valores por defecto del sistema. */
export const configuracion = pgTable(
  "configuracion",
  {
    id: idPk(),
    razon_social: text("razon_social"),
    cuit: text("cuit"),
    direccion: text("direccion"),
    telefono: text("telefono"),
    email: text("email"),
    logo_url: text("logo_url"),
    tolerancia_merma_pct: porcentaje("tolerancia_merma_pct").default("0.5"),
    base_calculo_flete_default: baseCalculoEnum("base_calculo_flete_default").default(
      "destino"
    ),
    modalidad_tarifa_default: modalidadTarifaEnum("modalidad_tarifa_default").default(
      "por_tonelada"
    ),
    unidad_carga_default: unidadCargaEnum("unidad_carga_default").default("toneladas"),
    porcentaje_chofer_default: porcentaje("porcentaje_chofer_default").default("15"),
    alerta_ctg_horas: integer("alerta_ctg_horas").default(24),
    alerta_vencimientos_dias: integer("alerta_vencimientos_dias").default(30),
    // Umbral de diferencia % entre valor_tarifa (real) y
    // valor_tarifa_declarada (documento) que dispara la alerta.
    alerta_diferencia_tarifa_pct: porcentaje("alerta_diferencia_tarifa_pct").default("5"),
  },
  () => [accesoTotalAutenticados("configuracion")]
).enableRLS();

export const condicionesPago = pgTable(
  "condiciones_pago",
  {
    id: idPk(),
    nombre: text("nombre").notNull().unique(),
    dias: integer("dias"),
    observaciones: text("observaciones"),
  },
  () => [accesoTotalAutenticados("condiciones_pago")]
).enableRLS();

export const mediosPago = pgTable(
  "medios_pago",
  {
    id: idPk(),
    nombre: text("nombre").notNull().unique(),
    requiere_datos_cheque: boolean("requiere_datos_cheque").notNull().default(false),
    activo: boolean("activo").notNull().default(true),
  },
  () => [accesoTotalAutenticados("medios_pago")]
).enableRLS();

export const tiposAdicional = pgTable(
  "tipos_adicional",
  {
    id: idPk(),
    nombre: text("nombre").notNull().unique(),
    a_cargo_default: aCargoEnum("a_cargo_default"),
    activo: boolean("activo").notNull().default(true),
  },
  () => [accesoTotalAutenticados("tipos_adicional")]
).enableRLS();

export const tiposGasto = pgTable(
  "tipos_gasto",
  {
    id: idPk(),
    nombre: text("nombre").notNull().unique(),
    activo: boolean("activo").notNull().default(true),
  },
  () => [accesoTotalAutenticados("tipos_gasto")]
).enableRLS();

export const tiposContingencia = pgTable(
  "tipos_contingencia",
  {
    id: idPk(),
    nombre: text("nombre").notNull().unique(),
    activo: boolean("activo").notNull().default(true),
  },
  () => [accesoTotalAutenticados("tipos_contingencia")]
).enableRLS();

export const estacionesServicio = pgTable(
  "estaciones_servicio",
  {
    id: idPk(),
    nombre: text("nombre").notNull().unique(),
    localidad: text("localidad"),
    provincia: text("provincia"),
    tiene_cuenta_corriente: boolean("tiene_cuenta_corriente").notNull().default(false),
    observaciones: text("observaciones"),
    activo: boolean("activo").notNull().default(true),
  },
  () => [accesoTotalAutenticados("estaciones_servicio")]
).enableRLS();

export const productos = pgTable(
  "productos",
  {
    id: idPk(),
    nombre: text("nombre").notNull().unique(),
    tipo: tipoProductoEnum("tipo"),
    precio_referencia: dinero("precio_referencia"),
    activo: boolean("activo").notNull().default(true),
  },
  () => [accesoTotalAutenticados("productos")]
).enableRLS();
