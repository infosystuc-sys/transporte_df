"use server";

import { extraerComprobante, type ComprobanteExtraido } from "./claude";
import { extraerComprobanteDescarga, type ComprobanteDescargaExtraido } from "./claude-descarga";

function archivoDeFormData(formData: FormData): File {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) throw new Error("Falta el archivo del comprobante.");
  return archivo;
}

/**
 * Extrae los datos de un comprobante por IA. Mismo patrón que
 * procesarCpe: nunca guarda nada — el resultado se muestra en el
 * formulario de alta correspondiente (gasoil, gastos, adicionales) para
 * que se revise y confirme antes de guardar.
 */
export async function previsualizarComprobante(formData: FormData): Promise<ComprobanteExtraido> {
  const archivo = archivoDeFormData(formData);
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const extraido = await extraerComprobante(buffer);
  if (!extraido) {
    throw new Error(
      "No se pudo leer el comprobante automáticamente. Cargá los datos a mano."
    );
  }
  return extraido;
}

/** Mismo patrón que previsualizarComprobante, pero para el ticket de balanza de descarga. */
export async function previsualizarComprobanteDescarga(
  formData: FormData
): Promise<ComprobanteDescargaExtraido> {
  const archivo = archivoDeFormData(formData);
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const extraido = await extraerComprobanteDescarga(buffer);
  if (!extraido) {
    throw new Error(
      "No se pudo leer el comprobante automáticamente. Cargá los datos a mano."
    );
  }
  return extraido;
}
