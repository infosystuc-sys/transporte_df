import { pgEnum } from "drizzle-orm/pg-core";

export const estadoViajeEnum = pgEnum("estado_viaje", [
  "planificado",
  "cargado",
  "en_transito",
  "descargado",
  "facturado",
  "cobrado",
  "liquidado",
]);

export const tipoCargaEnum = pgEnum("tipo_carga", ["grano", "otro"]);

export const declaracionCalidadEnum = pgEnum("declaracion_calidad", [
  "conforme",
  "condicional",
]);

export const modalidadTarifaEnum = pgEnum("modalidad_tarifa", [
  "por_tonelada",
  "por_km",
  "por_tonelada_km",
  "monto_fijo",
]);

/** Usado por configuracion.base_calculo_flete_default y viajes.base_calculo. */
export const baseCalculoEnum = pgEnum("base_calculo", ["origen", "destino"]);

/** clientes.base_calculo_flete admite además "heredar" el valor global. */
export const baseCalculoClienteEnum = pgEnum("base_calculo_cliente", [
  "origen",
  "destino",
  "heredar",
]);

export const unidadCargaEnum = pgEnum("unidad_carga", ["toneladas", "kilogramos"]);

export const tipoLugarEnum = pgEnum("tipo_lugar", [
  "campo",
  "planta",
  "acopio",
  "puerto",
  "otro",
]);

export const tipoProductoEnum = pgEnum("tipo_producto", ["grano", "fertilizante", "otro"]);

export const modalidadPagoChoferEnum = pgEnum("modalidad_pago_chofer", [
  "porcentaje_flete",
  "monto_fijo_viaje",
  "por_tonelada",
  "sueldo",
  "sin_definir",
]);

/** A quién queda a cargo un adicional o una diferencia. */
export const aCargoEnum = pgEnum("a_cargo", ["cliente", "empresa"]);

/** Quién pagó un gasto del viaje. */
export const pagadoPorEnum = pgEnum("pagado_por", ["empresa", "chofer"]);

export const entidadAdjuntoEnum = pgEnum("entidad_adjunto", [
  "viaje",
  "cobro",
  "carga_gasoil",
  "liquidacion",
]);

export const tipoAdjuntoEnum = pgEnum("tipo_adjunto", [
  "cpe_pdf",
  "ticket_balanza",
  "remito",
  "factura",
  "comprobante",
  "otro",
]);

export const modalidadGasoilEnum = pgEnum("modalidad_gasoil", [
  "cuenta_corriente",
  "pagado_por_chofer",
]);

export const tipoMovimientoChoferEnum = pgEnum("tipo_movimiento_chofer", [
  "adelanto",
  "gasoil",
  "gasto_rendido",
  "liquidacion",
  "devolucion",
  "ajuste",
]);

export const tipoRetencionEnum = pgEnum("tipo_retencion", [
  "ganancias",
  "iibb",
  "iva",
  "sicore",
  "otro",
]);
