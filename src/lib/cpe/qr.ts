import jsQR from "jsqr";
import { renderizarPrimeraPagina } from "./render";

/**
 * Renderiza la primera página del PDF y decodifica el QR (spec 5, paso 2).
 * Devuelve el contenido del QR (referencia de ARCA) o null si no hay QR,
 * no se puede renderizar, o falla por cualquier motivo — este paso es un
 * complemento del texto, nunca bloquea la importación.
 */
export async function decodificarQrCpe(buffer: Buffer): Promise<string | null> {
  try {
    const canvas = await renderizarPrimeraPagina(buffer);
    const contexto = canvas.getContext("2d");
    const datos = contexto.getImageData(0, 0, canvas.width, canvas.height);
    const qr = jsQR(datos.data as unknown as Uint8ClampedArray, datos.width, datos.height);
    return qr?.data ?? null;
  } catch {
    return null;
  }
}
