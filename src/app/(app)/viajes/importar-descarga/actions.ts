"use server";

import { extraerComprobanteDescarga, type ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import { buscarViajesPorCtg, type ViajeEncontradoPorCtg } from "../_lib/buscar-ctg";

const MENSAJE_NO_LEIDO =
  "No se pudo leer el comprobante automáticamente. Buscá el viaje a mano desde el listado de Viajes.";

type Resultado =
  | { ok: true; viajes: ViajeEncontradoPorCtg[]; datos: ComprobanteDescargaExtraido }
  | { ok: false; error: string };

/**
 * Lee el CTG del comprobante de descarga (ticket de balanza / nota de
 * recepción) y busca el viaje que ya tiene ese CTG cargado desde el
 * origen -- nunca guarda nada, el resultado se confirma en la pantalla
 * de revisión (mismo patrón que procesarCpe). Devuelve {error} en vez de
 * tirar: Next.js redacta cualquier error no capturado que sale de una
 * Server Action.
 */
export async function previsualizarImportacionDescarga(formData: FormData): Promise<Resultado> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return { ok: false, error: "Falta el archivo." };

  let datos: ComprobanteDescargaExtraido | null;
  try {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    datos = await extraerComprobanteDescarga(buffer);
  } catch (err) {
    console.error("previsualizarImportacionDescarga:", err);
    return { ok: false, error: MENSAJE_NO_LEIDO };
  }
  if (!datos) return { ok: false, error: MENSAJE_NO_LEIDO };
  if (!datos.ctg) {
    return {
      ok: false,
      error: "No se encontró el CTG en el documento. Buscá el viaje a mano desde el listado de Viajes.",
    };
  }

  const encontrados = await buscarViajesPorCtg(datos.ctg);
  return { ok: true, viajes: encontrados, datos };
}
