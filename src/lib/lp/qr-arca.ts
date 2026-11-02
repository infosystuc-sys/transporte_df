import { decodificarQrCpe } from "@/lib/cpe/qr";

/** Datos del QR que ARCA exige en los comprobantes electrónicos. */
export type QrArca = {
  emisor_cuit: string;
  receptor_cuit: string | null;
  numero: string | null; // "0006-00012405" (sin la letra, el QR no la trae)
  fecha: string | null; // yyyy-mm-dd
  importe: number | null;
  cae: string | null;
};

/**
 * El QR de ARCA es una URL ".../fe/qr/?p=<JSON en base64>" con el CUIT del
 * emisor, el del receptor, punto de venta, número, fecha, importe y CAE.
 * Sirve para completar lo que un formato no trae como texto (ej. la CVLP de
 * Buenos Viajes tiene el CUIT del emisor solo en el logo). null si no hay
 * QR o no es de ARCA.
 */
export function interpretarQrArca(contenido: string): QrArca | null {
  try {
    const p = new URL(contenido).searchParams.get("p");
    if (!p) return null;
    const datos = JSON.parse(Buffer.from(p, "base64").toString("utf8"));
    if (!datos?.cuit) return null;
    const pto = datos.ptoVta != null ? String(datos.ptoVta).padStart(4, "0") : null;
    const nro = datos.nroCmp != null ? String(datos.nroCmp).padStart(8, "0") : null;
    return {
      emisor_cuit: String(datos.cuit),
      receptor_cuit: datos.nroDocRec != null ? String(datos.nroDocRec) : null,
      numero: pto && nro ? `${pto}-${nro}` : null,
      fecha: typeof datos.fecha === "string" ? datos.fecha : null,
      importe: typeof datos.importe === "number" ? datos.importe : null,
      cae: datos.codAut != null ? String(datos.codAut) : null,
    };
  } catch {
    return null;
  }
}

export async function leerQrArca(buffer: Buffer): Promise<QrArca | null> {
  const contenido = await decodificarQrCpe(buffer);
  return contenido ? interpretarQrArca(contenido) : null;
}
