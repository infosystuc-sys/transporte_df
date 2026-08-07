import type { NextRequest } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { clientes, cobros, mediosPago } from "@/db/schema";
import { generarXlsx, respuestaXlsx } from "@/lib/reportes/xlsx";

const formatoFecha = (v: Date | string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const condiciones = [];
  const fechaDesde = sp.get("fecha_desde");
  if (fechaDesde) condiciones.push(gte(cobros.fecha, new Date(fechaDesde)));
  const fechaHasta = sp.get("fecha_hasta");
  if (fechaHasta) condiciones.push(lte(cobros.fecha, new Date(fechaHasta)));

  let consulta = db
    .select({
      fecha: cobros.fecha,
      cliente: clientes.razon_social,
      medio_pago: mediosPago.nombre,
      importe: cobros.importe,
      referencia: cobros.referencia,
      banco: cobros.banco,
    })
    .from(cobros)
    .leftJoin(clientes, eq(cobros.cliente_id, clientes.id))
    .leftJoin(mediosPago, eq(cobros.medio_pago_id, mediosPago.id))
    .$dynamic();

  if (condiciones.length > 0) consulta = consulta.where(and(...condiciones));
  const filas = await consulta;

  const buffer = generarXlsx([
    {
      nombre: "Cobros",
      filas: filas.map((f) => ({
        Fecha: formatoFecha(f.fecha),
        Cliente: f.cliente,
        "Medio de pago": f.medio_pago,
        Importe: f.importe,
        Referencia: f.referencia,
        Banco: f.banco,
      })),
    },
  ]);

  return respuestaXlsx(buffer, "cobros.xlsx");
}
