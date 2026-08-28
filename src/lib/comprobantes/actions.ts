"use server";

import { extraerComprobante, type ComprobanteExtraido } from "./claude";
import { extraerComprobanteDescarga, type ComprobanteDescargaExtraido } from "./claude-descarga";
import { buscarCamionPorPatente, buscarChoferPorNombreParcial } from "./matching";

type Resultado<T> = T | { error: string };

function archivoDeFormData(formData: FormData): File | null {
  const archivo = formData.get("archivo");
  return archivo instanceof File ? archivo : null;
}

const MENSAJE_NO_LEIDO = "No se pudo leer el comprobante automáticamente. Cargá los datos a mano.";

/**
 * Extrae los datos de un comprobante por IA. Mismo patrón que
 * procesarCpe: nunca guarda nada — el resultado se muestra en el
 * formulario de alta correspondiente (gasoil, gastos, adicionales) para
 * que se revise y confirme antes de guardar.
 *
 * Devuelve {error} en vez de tirar una excepción: Next.js redacta
 * cualquier error no capturado que salga de una Server Action (al
 * cliente le llega solo un 500 con un digest genérico, sin el mensaje),
 * así que la única forma de que el motivo real llegue a la pantalla es
 * devolviéndolo, nunca lanzándolo.
 */
export async function previsualizarComprobante(
  formData: FormData
): Promise<Resultado<ComprobanteExtraido>> {
  const archivo = archivoDeFormData(formData);
  if (!archivo) return { error: "Falta el archivo del comprobante." };
  try {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const extraido = await extraerComprobante(buffer);
    if (!extraido) return { error: MENSAJE_NO_LEIDO };
    const [camion_id, chofer_id] = await Promise.all([
      buscarCamionPorPatente(extraido.patente),
      buscarChoferPorNombreParcial(extraido.chofer_nombre),
    ]);
    return { ...extraido, camion_id, chofer_id };
  } catch (err) {
    console.error("previsualizarComprobante:", err);
    return { error: MENSAJE_NO_LEIDO };
  }
}

/** Mismo patrón que previsualizarComprobante, pero para el ticket de balanza de descarga. */
export async function previsualizarComprobanteDescarga(
  formData: FormData
): Promise<Resultado<ComprobanteDescargaExtraido>> {
  const archivo = archivoDeFormData(formData);
  if (!archivo) return { error: "Falta el archivo del comprobante." };
  try {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const extraido = await extraerComprobanteDescarga(buffer);
    if (!extraido) return { error: MENSAJE_NO_LEIDO };
    return extraido;
  } catch (err) {
    console.error("previsualizarComprobanteDescarga:", err);
    return { error: MENSAJE_NO_LEIDO };
  }
}
