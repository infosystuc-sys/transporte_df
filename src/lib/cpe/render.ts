import { createRequire } from "node:module";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import convertirHeic from "heic-convert";
import { aplicarTransformExif, leerOrientacionExif, orientacionRotada } from "./exif-orientacion";

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
 * Lado largo máximo (en px) al que se reescala una foto antes de
 * mandarla a Claude. Por encima de ~1568px de lado largo Claude ya la
 * reescala él mismo para procesarla -- ir más grande que esto no suma
 * nitidez real, solo infla el archivo. Se deja un margen sobre ese valor.
 */
export const LADO_LARGO_MAX_IA = 2000;

/** Calidad JPEG para las imágenes que se mandan a Claude (0-1). */
const CALIDAD_JPEG_IA = 0.92;

/**
 * Codifica el canvas para mandarlo a Claude. JPEG en vez de PNG: para
 * contenido con ruido fotográfico (una foto de celular), JPEG comprime
 * muchísimo mejor que PNG para el mismo detalle visible, lo que ayuda a
 * no acercarse al límite de tamaño de la Server Action en fotos de alta
 * resolución. A esta calidad no se nota en texto renderizado desde PDF.
 */
export function canvasParaClaude(canvas: { toBuffer(mime: "image/jpeg", quality?: number): Buffer }) {
  return {
    media_type: "image/jpeg" as const,
    data: canvas.toBuffer("image/jpeg", CALIDAD_JPEG_IA).toString("base64"),
  };
}

// Todo PDF arranca con estos 4 bytes ("%PDF"), sea cual sea la versión.
const MAGIC_PDF = Buffer.from("%PDF");

function esPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, MAGIC_PDF.length).equals(MAGIC_PDF);
}

// HEIC/HEIF (formato por defecto de la cámara de iPhone) es un contenedor
// ISO-BMFF: bytes 4-8 dicen "ftyp" y bytes 8-12 son el "major brand". No
// hay forma de detectarlo por los primeros bytes solos como con PDF.
const MARCAS_HEIC = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

function esHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  return MARCAS_HEIC.has(buffer.subarray(8, 12).toString("ascii"));
}

async function renderizarPaginaPdf(buffer: Buffer, escala: number) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // En Node.js pdfjs-dist siempre corre en modo "fake worker" (no hay
  // Worker real). Para conseguir el código que necesita, primero se fija
  // si alguien ya dejó `globalThis.pdfjsWorker` puesto -- y si no, recién
  // ahí intenta `import(GlobalWorkerOptions.workerSrc)`, con un string
  // que arma en runtime (no un specifier literal), así que ningún
  // bundler puede rastrearlo: en el serverless de Vercel el archivo
  // queda afuera del bundle y explota con "Cannot find module
  // .../pdf.worker.mjs" (probado en vivo, dos veces, con dos intentos
  // de forzar el include vía config que tampoco llegaron a buen puerto).
  // La salida es no depender de ese import dinámico para nada: el propio
  // pdf.worker.mjs, con solo importarlo, deja `globalThis.pdfjsWorker`
  // seteado como efecto de lado -- y como acá el specifier SÍ es un
  // string literal, el bundler lo ve y lo incluye solo, sin config extra.
  // @ts-expect-error -- pdfjs-dist no publica tipos para este subpath;
  // el import es solo por el efecto de lado, no hace falta lo que exporte.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
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

async function renderizarImagen(buffer: Buffer, ladoLargoMax?: number) {
  const imagen = await loadImage(buffer);

  // Las fotos de celular traen la rotación real en un tag EXIF en vez de
  // en los píxeles — @napi-rs/canvas decodifica tal cual viene el sensor,
  // así que sin esto una CPE fotografiada en vertical llega de costado a
  // la IA (spec: ver exif-orientacion.ts).
  const orientacion = leerOrientacionExif(buffer);
  const rotada = orientacionRotada(orientacion);
  const anchoOrientado = rotada ? imagen.height : imagen.width;
  const altoOrientado = rotada ? imagen.width : imagen.height;

  const canvasOrientado = createCanvas(anchoOrientado, altoOrientado);
  const contextoOrientado = canvasOrientado.getContext("2d");
  aplicarTransformExif(contextoOrientado, orientacion, imagen.width, imagen.height);
  contextoOrientado.drawImage(imagen, 0, 0);

  const ladoLargo = Math.max(anchoOrientado, altoOrientado);
  if (!ladoLargoMax || ladoLargo <= ladoLargoMax) return canvasOrientado;

  // Una foto de celular moderna (3000-8000px de lado largo) supera por
  // mucho la resolución que Claude aprovecha (~1568px) -- mandarla entera
  // solo infla el archivo (arriesgando el límite de tamaño de la Server
  // Action) sin sumar nitidez real, y deja el downscale final en manos de
  // un algoritmo que no controlamos. Se reescala acá una sola vez, antes
  // de codificarla, en vez de confiar en el resize automático de Claude.
  const factor = ladoLargoMax / ladoLargo;
  const anchoFinal = Math.round(anchoOrientado * factor);
  const altoFinal = Math.round(altoOrientado * factor);
  const canvasFinal = createCanvas(anchoFinal, altoFinal);
  canvasFinal.getContext("2d").drawImage(canvasOrientado, 0, 0, anchoFinal, altoFinal);
  return canvasFinal;
}

/**
 * Renderiza la primera página del documento a canvas (usado para leer el
 * QR y para el fallback de Claude). Acepta PDF, JPG/PNG y HEIC/HEIF (el
 * formato por defecto de la cámara de iPhone, que @napi-rs/canvas no sabe
 * decodificar) — se detecta por los magic bytes, no por el nombre de
 * archivo ni el content-type declarado, que no son confiables. Devuelve
 * el canvas directamente para poder leer tanto ImageData (jsQR) como PNG
 * (Claude) sin re-decodificar.
 *
 * ladoLargoMaxImagen solo aplica al camino de foto (no al de PDF): la
 * lectura de QR quiere la resolución nativa completa (un QR chico dentro
 * de la foto necesita esos píxeles), así que por defecto no se toca; los
 * llamados que arman la imagen para Claude sí lo piden explícitamente.
 */
export async function renderizarPrimeraPagina(
  buffer: Buffer,
  escala = 2,
  ladoLargoMaxImagen?: number
) {
  if (esPdf(buffer)) return renderizarPaginaPdf(buffer, escala);
  if (esHeic(buffer)) {
    // libheif ya aplica la rotación (irot/imir) al decodificar, así que
    // el JPEG que sale acá viene derecho -- no necesita pasar de nuevo
    // por la corrección EXIF de renderizarImagen (que igual no encontrará
    // tag de orientación en un JPEG recién codificado y no hará nada).
    const jpeg = await convertirHeic({ buffer, format: "JPEG", quality: 0.92 });
    return renderizarImagen(Buffer.from(jpeg), ladoLargoMaxImagen);
  }
  return renderizarImagen(buffer, ladoLargoMaxImagen);
}
