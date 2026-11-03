/** Empresa que recibe el flete o el cobro, con los códigos del Cash Flow. */
export type EmpresaReceptora = "san" | "sas";

/**
 * Único lugar donde se decide la empresa (Rafael Sánchez = "san", Grupo Don
 * Félix SAS = "sas"). Todavía no está definido cómo se identifica (camión,
 * cliente o CUIT receptor del LP / orden de pago), así que por ahora todo
 * es "san". Cuando se defina, se cambia solo acá.
 */
export function empresaReceptora(datos: { cliente_id: number | null }): EmpresaReceptora {
  void datos; // lo va a usar la regla definitiva
  return "san";
}
