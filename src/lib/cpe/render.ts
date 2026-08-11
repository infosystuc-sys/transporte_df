import { createRequire } from "node:module";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";

const require = createRequire(import.meta.url);

/**
 * Ubica la carpeta de pdfjs-dist para poder pasarle standard_fonts/cmaps.
 * No puede vivir en el top level del módulo: bajo Turbopack (build de
 * producción), con pdfjs-dist como serverExternalPackages, require.resolve
 * sobre un paquete externalizado devuelve el id numérico interno del chunk
 * en vez de un path real, y path.dirname(numero) tira TypeError. Si eso
 * pasara en el top level, se lleva puesta toda la Server Action al cargar
 * el módulo, sin que ningún try/catch de más abajo llegue a atajarlo. Acá
 * adentro, si falla, se sigue sin fuentes/cmaps en vez de romper todo.
 */
function rutaFactory(sub: string): string | undefined {
  try {
    const carpetaPdfjs = path.dirname(require.resolve("pdfjs-dist/package.json"));
    return path.join(carpetaPdfjs, sub).replace(/\\/g, "/") + "/";
  } catch {
    return undefined;
  }
}

/**
 * Renderiza la primera página del PDF a canvas (usado para leer el QR y
 * para el fallback de Claude). Devuelve el canvas directamente para poder
 * leer tanto ImageData (jsQR) como PNG (Claude) sin re-decodificar.
 */
export async function renderizarPrimeraPagina(buffer: Buffer, escala = 2) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // No está en los tipos de esta versión, pero pdfjs sí lo respeta en
    // runtime — sin esto intenta levantar un worker thread que no hace
    // falta acá (todo corre sync en el mismo proceso de Node).
    // @ts-expect-error -- ver comentario arriba.
    disableWorker: true,
    standardFontDataUrl: rutaFactory("standard_fonts"),
    cMapUrl: rutaFactory("cmaps"),
    cMapPacked: true,
  }).promise;
  const pagina = await doc.getPage(1);
  const viewport = pagina.getViewport({ scale: escala });

  const canvas = createCanvas(viewport.width, viewport.height);
  const contexto = canvas.getContext("2d");

  await pagina.render({
    // @ts-expect-error -- @napi-rs/canvas implementa la misma API que
    // pdfjs espera de un CanvasRenderingContext2D del navegador.
    canvasContext: contexto,
    viewport,
  }).promise;

  return canvas;
}
