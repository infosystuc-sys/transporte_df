export type BaseCalculo = "origen" | "destino";
export type ModalidadTarifa = "por_tonelada" | "por_km" | "por_tonelada_km" | "monto_fijo";

/**
 * Cascada de defaults de tarifa (spec 4.5): base_calculo sale del
 * cliente (salvo que el cliente diga "heredar"), y si no de la
 * configuración global; modalidad_tarifa no tiene noción de cliente,
 * sale directo de la configuración global. Función pura (sin acceso a
 * DB) a propósito: la usa tanto el server (recalcularFlete, para
 * autocorregir un viaje que ya existe) como el cliente (para precargar
 * la pantalla de revisión de Importar CPE antes de crear el viaje) — así
 * no hace falta arrastrar el módulo de la base de datos al bundle del
 * cliente.
 */
export function resolverCascadaTarifa(
  clienteBaseCalculo: BaseCalculo | "heredar" | null | undefined,
  configDefaults: {
    base_calculo_flete_default: BaseCalculo | null | undefined;
    modalidad_tarifa_default: ModalidadTarifa | null | undefined;
  }
): { baseCalculo: BaseCalculo; modalidadTarifa: ModalidadTarifa | null } {
  const baseCalculo: BaseCalculo =
    clienteBaseCalculo && clienteBaseCalculo !== "heredar"
      ? clienteBaseCalculo
      : (configDefaults.base_calculo_flete_default ?? "destino");

  const modalidadTarifa = configDefaults.modalidad_tarifa_default ?? null;

  return { baseCalculo, modalidadTarifa };
}
