import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { camiones, choferes, clientes, productos, viajes, lugares } from "@/db/schema";
import { condicionesFiltroViajes } from "@/app/(app)/viajes/_lib/filtros";
import { generarXlsx, respuestaXlsx } from "@/lib/reportes/xlsx";

const origenLugar = alias(lugares, "origen_lugar");
const destinoLugar = alias(lugares, "destino_lugar");

const formatoFecha = (v: Date | string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const where = condicionesFiltroViajes(sp);

  let consulta = db
    .select({
      numero: viajes.numero,
      estado: viajes.estado,
      fecha_carga: viajes.fecha_carga,
      fecha_descarga: viajes.fecha_descarga,
      ctg: viajes.ctg,
      cpe_nro: viajes.cpe_nro,
      cliente: clientes.razon_social,
      chofer: choferes.nombre_completo,
      dominio_tractor: viajes.dominio_tractor,
      producto: productos.nombre,
      origen: origenLugar.nombre,
      destino: destinoLugar.nombre,
      neto_origen_kg: viajes.neto_origen,
      neto_destino_kg: viajes.neto_destino,
      merma_pct: viajes.merma_pct,
      valor_tarifa: viajes.valor_tarifa,
      importe_flete: viajes.importe_flete,
      total_a_cobrar: viajes.total_a_cobrar,
      importe_cobrado: viajes.importe_cobrado,
      saldo_pendiente: viajes.saldo_pendiente,
      importe_liquidacion_chofer: viajes.importe_liquidacion_chofer,
      liquidado: viajes.liquidado,
    })
    .from(viajes)
    .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
    .leftJoin(choferes, eq(viajes.chofer_id, choferes.id))
    .leftJoin(camiones, eq(viajes.camion_id, camiones.id))
    .leftJoin(productos, eq(viajes.producto_id, productos.id))
    .leftJoin(origenLugar, eq(viajes.origen_id, origenLugar.id))
    .leftJoin(destinoLugar, eq(viajes.destino_id, destinoLugar.id))
    .$dynamic();

  if (where) consulta = consulta.where(where);
  const filas = await consulta;

  const buffer = generarXlsx([
    {
      nombre: "Viajes",
      filas: filas.map((f) => ({
        "N°": f.numero,
        Estado: f.estado,
        "Fecha de carga": formatoFecha(f.fecha_carga),
        "Fecha de descarga": formatoFecha(f.fecha_descarga),
        CTG: f.ctg,
        "N° CPE": f.cpe_nro,
        Cliente: f.cliente,
        Chofer: f.chofer,
        "Dominio tractor": f.dominio_tractor,
        Producto: f.producto,
        Origen: f.origen,
        Destino: f.destino,
        "Neto origen (kg)": f.neto_origen_kg,
        "Neto destino (kg)": f.neto_destino_kg,
        "Merma (%)": f.merma_pct,
        "Valor tarifa": f.valor_tarifa,
        "Importe flete": f.importe_flete,
        "Total a cobrar": f.total_a_cobrar,
        "Importe cobrado": f.importe_cobrado,
        "Saldo pendiente": f.saldo_pendiente,
        "Liquidación chofer": f.importe_liquidacion_chofer,
        Liquidado: f.liquidado ? "Sí" : "No",
      })),
    },
  ]);

  return respuestaXlsx(buffer, "viajes.xlsx");
}
