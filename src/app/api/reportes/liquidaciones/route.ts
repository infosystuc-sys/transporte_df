import type { NextRequest } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { choferes, liquidacionesChofer, mediosPago } from "@/db/schema";
import { generarXlsx, respuestaXlsx } from "@/lib/reportes/xlsx";

const formatoFecha = (v: Date | string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const condiciones = [];
  const fechaDesde = sp.get("fecha_desde");
  if (fechaDesde) condiciones.push(gte(liquidacionesChofer.fecha, new Date(fechaDesde)));
  const fechaHasta = sp.get("fecha_hasta");
  if (fechaHasta) condiciones.push(lte(liquidacionesChofer.fecha, new Date(fechaHasta)));

  let consulta = db
    .select({
      fecha: liquidacionesChofer.fecha,
      chofer: choferes.nombre_completo,
      total_viajes: liquidacionesChofer.total_viajes,
      total_adelantos: liquidacionesChofer.total_adelantos,
      total_neto: liquidacionesChofer.total_neto,
      pagado: liquidacionesChofer.pagado,
      medio_pago: mediosPago.nombre,
    })
    .from(liquidacionesChofer)
    .leftJoin(choferes, eq(liquidacionesChofer.chofer_id, choferes.id))
    .leftJoin(mediosPago, eq(liquidacionesChofer.medio_pago_id, mediosPago.id))
    .$dynamic();

  if (condiciones.length > 0) consulta = consulta.where(and(...condiciones));
  const filas = await consulta;

  const buffer = generarXlsx([
    {
      nombre: "Liquidaciones",
      filas: filas.map((f) => ({
        Fecha: formatoFecha(f.fecha),
        Chofer: f.chofer,
        "Viajes incluidos": f.total_viajes,
        Deducciones: f.total_adelantos,
        "Total neto": f.total_neto,
        Pagada: f.pagado ? "Sí" : "No",
        "Medio de pago": f.medio_pago,
      })),
    },
  ]);

  return respuestaXlsx(buffer, "liquidaciones.xlsx");
}
