import { parseTextoCpe, type CpeExtraido } from "./parser";
import { extraerTextoCpe } from "./extraer";
import { decodificarQrCpe } from "./qr";
import { extraerConClaude } from "./claude";
import { buscarCoincidencias, type Coincidencias } from "./matching";

export type FuenteExtraccionCpe = "texto" | "claude" | "manual";

export type ResultadoImportacionCpe = {
  extraido: CpeExtraido;
  fuente: FuenteExtraccionCpe;
  referenciaQr: string | null;
  coincidencias: Coincidencias;
};

/**
 * Si ni el N° de CPE ni el CUIT del titular se detectaron, el texto
 * extraído no tiene la estructura esperada (típico de un PDF escaneado
 * sin capa de texto) — ahí vale la pena intentar el fallback de Claude.
 */
function extraccionInsuficiente(cpe: CpeExtraido): boolean {
  return !cpe.cpe_nro && !cpe.titular_cuit;
}

/**
 * Cascada completa de importación de CPE (spec 5): texto → QR (siempre, en
 * paralelo, como referencia) → Claude (solo si el texto no alcanzó) →
 * matching contra catálogos existentes. Nunca guarda nada — el resultado
 * se muestra en la pantalla de revisión para confirmación manual.
 */
export async function procesarCpe(buffer: Buffer): Promise<ResultadoImportacionCpe> {
  const [referenciaQr, texto] = await Promise.all([
    decodificarQrCpe(buffer),
    extraerTextoCpe(buffer),
  ]);

  let extraido = parseTextoCpe(texto);
  let fuente: FuenteExtraccionCpe = "texto";

  if (extraccionInsuficiente(extraido)) {
    const porClaude = await extraerConClaude(buffer);
    if (porClaude) {
      extraido = porClaude;
      fuente = "claude";
    } else {
      fuente = "manual";
    }
  }

  const coincidencias = await buscarCoincidencias(extraido);

  return { extraido, fuente, referenciaQr, coincidencias };
}
