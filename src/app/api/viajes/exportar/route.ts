import type { NextRequest } from "next/server";
import { condicionesFiltroViajes } from "@/app/(app)/viajes/_lib/filtros";
import { ordenViajes } from "@/app/(app)/viajes/_lib/orden";
import { consultaViajes } from "@/app/(app)/viajes/_lib/consulta";

function celda(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const where = condicionesFiltroViajes(sp);
  const orden = ordenViajes(sp.sort, sp.dir);

  const filas = where
    ? await consultaViajes().where(where).orderBy(orden)
    : await consultaViajes().orderBy(orden);

  const encabezados = [
    "numero",
    "fecha_carga",
    "ctg",
    "cpe_nro",
    "cliente",
    "origen",
    "destino",
    "dominio_tractor",
    "chofer",
    "producto",
    "tn_destino",
    "valor_tarifa",
    "estado",
  ];

  const lineas = [encabezados.join(";")];
  for (const f of filas) {
    lineas.push(
      [
        f.numero,
        f.fecha_carga ? new Date(f.fecha_carga).toISOString().slice(0, 10) : "",
        f.ctg,
        f.cpe_nro,
        f.cliente_nombre,
        f.origen_nombre,
        f.destino_nombre,
        f.dominio_tractor,
        f.chofer_nombre,
        f.producto_nombre,
        f.neto_destino ? (Number(f.neto_destino) / 1000).toFixed(2) : "",
        f.valor_tarifa,
        f.estado,
      ]
        .map(celda)
        .join(";")
    );
  }

  const csv = "﻿" + lineas.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="viajes.csv"`,
    },
  });
}
