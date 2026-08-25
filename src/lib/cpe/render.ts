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

async function renderizarImagen(buffer: Buffer) {
  const imagen = await loadImage(buffer);

  // Las fotos de celular traen la rotación real en un tag EXIF en vez de
  // en los píxeles — @napi-rs/canvas decodifica tal cual viene el sensor,
  // así que sin esto una CPE fotografiada en vertical llega de costado a
  // la IA (spec: ver exif-orientacion.ts).
  const orientacion = leerOrientacionExif(buffer);
  const rotada = orientacionRotada(orientacion);
  const canvas = createCanvas(
    rotada ? imagen.height : imagen.width,
    rotada ? imagen.width : imagen.height
  );
  const contexto = canvas.getContext("2d");
  aplicarTransformExif(contexto, orientacion, imagen.width, imagen.height);
  contexto.drawImage(imagen, 0, 0);
  return canvas;
}

/**
 * Renderiza la primera página del documento a canvas (usado para leer el
 * QR y para el fallback de Claude). Acepta PDF, JPG/PNG y HEIC/HEIF (el
 * formato por defecto de la cámara de iPhone, que @napi-rs/canvas no sabe
 * decodificar) — se detecta por los magic bytes, no por el nombre de
 * archivo ni el content-type declarado, que no son confiables. Devuelve
 * el canvas directamente para poder leer tanto ImageData (jsQR) como PNG
 * (Claude) sin re-decodificar.
 */
export async function renderizarPrimeraPagina(buffer: Buffer, escala = 2) {
  if (esPdf(buffer)) return renderizarPaginaPdf(buffer, escala);
  if (esHeic(buffer)) {
    // libheif ya aplica la rotación (irot/imir) al decodificar, así que
    // el JPEG que sale acá viene derecho -- no necesita pasar de nuevo
    // por la corrección EXIF de renderizarImagen (que igual no encontrará
    // tag de orientación en un JPEG recién codificado y no hará nada).
    const jpeg = await convertirHeic({ buffer, format: "JPEG", quality: 0.92 });
    return renderizarImagen(Buffer.from(jpeg));
  }
  return renderizarImagen(buffer);
}
