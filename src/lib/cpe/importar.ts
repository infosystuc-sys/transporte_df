import { parseTextoCpe, type CpeExtraido } from "./parser";
import { extraerTextoCpe } from "./extraer";
import { decodificarQrCpe } from "./qr";
import { extraerConClaude } from "./claude";
import {
  buscarCoincidencias,
  detectarFaltantes,
  type Coincidencias,
  type EntidadFaltante,
} from "./matching";

export type FuenteExtraccionCpe = "texto" | "claude" | "manual";

/**
 * Por qué terminó en carga manual (o en un resultado de IA vacío), para
 * que la pantalla de revisión pueda decirle al usuario qué hacer distinto
 * la próxima vez en vez de un genérico "no se pudo leer":
 * - "sin_conexion_ia": no hay clave configurada o la llamada a Claude
 *   falló (red, saldo, límite de tasa) -- no es culpa de la foto.
 * - "ilegible": Claude sí respondió pero no encontró los datos clave --
 *   típico de una foto borrosa, oscura o mal encuadrada.
 */
export type MotivoManual = "sin_conexion_ia" | "ilegible" | null;

export type ResultadoImportacionCpe = {
  extraido: CpeExtraido;
  fuente: FuenteExtraccionCpe;
  motivoManual: MotivoManual;
  referenciaQr: string | null;
  coincidencias: Coincidencias;
  /** Datos de la CPE que no existen todavía en los catálogos. */
  faltantes: EntidadFaltante[];
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
  let motivoManual: MotivoManual = null;

  if (extraccionInsuficiente(extraido)) {
    // Si Claude tira (red, límite de tasa, lo que sea) esto no puede
    // reventar sin capturar: Next.js redacta cualquier error no
    // capturado que salga de una Server Action, y el resultado sería un
    // 500 con un digest genérico en vez de caer prolijo a carga manual
    // (mismo motivo por el que previsualizarComprobante* devuelven
    // {error} en vez de tirar).
    try {
      const porClaude = await extraerConClaude(buffer);
      if (porClaude) {
        extraido = porClaude;
        fuente = "claude";
        // Claude respondió (no tiró, hay clave y conexión) pero tampoco
        // encontró los datos clave -- lo más probable es que la imagen
        // en sí no se pueda leer bien, no un problema de conexión.
        if (extraccionInsuficiente(porClaude)) motivoManual = "ilegible";
      } else {
        // Solo pasa sin clave configurada (ver extraerConClaude).
        fuente = "manual";
        motivoManual = "sin_conexion_ia";
      }
    } catch (err) {
      console.error("procesarCpe: falló el fallback de Claude:", err);
      fuente = "manual";
      motivoManual = "sin_conexion_ia";
    }
  }

  const coincidencias = await buscarCoincidencias(extraido);
  const faltantes = detectarFaltantes(extraido, coincidencias);

  return { extraido, fuente, motivoManual, referenciaQr, coincidencias, faltantes };
}
