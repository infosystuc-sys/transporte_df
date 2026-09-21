"use server";

import { extraerComprobanteDescarga, type ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import { buscarViajesPorCtgOCartaPorte, type ViajeEncontradoPorCtg } from "../_lib/buscar-ctg";

const MENSAJE_NO_LEIDO =
  "No se pudo leer el comprobante automáticamente. Buscá el viaje a mano desde el listado de Viajes.";

type Resultado =
  | { ok: true; viajes: ViajeEncontradoPorCtg[]; datos: ComprobanteDescargaExtraido }
  | { ok: false; error: string };

/**
 * Lee el CTG y/o el número de Carta de Porte del comprobante de descarga
 * (ticket de balanza / nota de recepción) y busca el viaje que ya tiene
 * ese CTG o esa Carta de Porte cargados desde el origen -- algunos
 * comprobantes (ej. balanzas de puertos/acopios) no traen CTG, solo su
 * propio número de Carta de Porte. Nunca guarda nada, el resultado se
 * confirma en la pantalla de revisión (mismo patrón que procesarCpe).
 * Devuelve {error} en vez de tirar: Next.js redacta cualquier error no
 * capturado que sale de una Server Action.
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
  if (!datos.ctg && !datos.cpe_nro) {
    return {
      ok: false,
      error:
        "No se encontró el CTG ni el número de Carta de Porte en el documento. Buscá el viaje a mano desde el listado de Viajes.",
    };
  }

  const encontrados = await buscarViajesPorCtgOCartaPorte(datos.ctg, datos.cpe_nro);
  return { ok: true, viajes: encontrados, datos };
}
