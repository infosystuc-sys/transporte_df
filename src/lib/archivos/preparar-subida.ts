/**
 * Vercel corta cualquier request de más de 4,5 MB antes de que llegue a la
 * Server Action (el cliente solo ve "An unexpected response was received
 * from the server"), sin importar el bodySizeLimit de next.config. Una
 * captura de pantalla en PNG de un documento escaneado (fondo gris con
 * ruido) o una foto de cámara de alta resolución lo superan fácil.
 */
export const LIMITE_SUBIDA_BYTES = Math.floor(4.4 * 1024 * 1024);

// Debajo de esto el archivo se sube tal cual: no hace falta perder calidad.
const UMBRAL_COMPRIMIR_BYTES = 3 * 1024 * 1024;

// Suficiente para que el QR de la CPE siga siendo legible y muy por encima
// de lo que la IA aprovecha (~1568 px de lado largo).
const LADO_LARGO_MAX = 3000;
const CALIDAD_JPEG = 0.9;

/**
 * Si el archivo es una imagen pesada, la reescala y la recodifica a JPEG en
 * el navegador antes de subirla. PDFs, imágenes livianas y cualquier caso
 * que el navegador no sepa decodificar (ej. HEIC fuera de Safari) se
 * devuelven sin tocar.
 */
export async function prepararArchivoParaSubir(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/") || archivo.size <= UMBRAL_COMPRIMIR_BYTES) {
    return archivo;
  }
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_LARGO_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const contexto = canvas.getContext("2d");
    if (!contexto) return archivo;
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CALIDAD_JPEG)
    );
    if (!blob || blob.size >= archivo.size) return archivo;

    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg", lastModified: archivo.lastModified });
  } catch {
    return archivo;
  }
}

export function mensajeArchivoMuyPesado(archivo: File): string | null {
  if (archivo.size <= LIMITE_SUBIDA_BYTES) return null;
  const mb = (archivo.size / (1024 * 1024)).toFixed(1);
  return `"${archivo.name}" pesa ${mb} MB y el máximo es 4,4 MB. Probá subir el PDF en vez de una captura de pantalla, o una foto con menos resolución.`;
}
