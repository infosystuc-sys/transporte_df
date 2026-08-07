import * as XLSX from "xlsx";

/** Arma un .xlsx con una o más hojas a partir de filas ya formateadas para mostrar. */
export function generarXlsx(hojas: { nombre: string; filas: Record<string, unknown>[] }[]): Buffer {
  const libro = XLSX.utils.book_new();
  for (const hoja of hojas) {
    const ws = XLSX.utils.json_to_sheet(hoja.filas);
    // El nombre de hoja de Excel tiene un máximo de 31 caracteres.
    XLSX.utils.book_append_sheet(libro, ws, hoja.nombre.slice(0, 31));
  }
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function respuestaXlsx(buffer: Buffer, nombreArchivo: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
