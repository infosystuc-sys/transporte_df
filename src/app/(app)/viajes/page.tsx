import type { Metadata } from "next";
import Link from "next/link";
import { asc, count } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, lugares, productos, viajes } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { BarraFiltros } from "./_componentes/barra-filtros";
import { TablaViajes } from "./_componentes/tabla-viajes";
import { Paginacion } from "./_componentes/paginacion";
import { condicionesFiltroViajes, type BusquedaViajes } from "./_lib/filtros";
import { ordenViajes } from "./_lib/orden";
import { consultaViajes } from "./_lib/consulta";

export const metadata: Metadata = {
  title: "Viajes — Gestión de Fletes",
};

const PAGE_SIZE = 25;

export default async function ViajesPage({
  searchParams,
}: {
  searchParams: Promise<BusquedaViajes>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = condicionesFiltroViajes(sp);
  const orden = ordenViajes(
    typeof sp.sort === "string" ? sp.sort : undefined,
    typeof sp.dir === "string" ? sp.dir : undefined
  );

  const [filasClientes, filasChoferes, filasCamiones, filasProductos, filasLugares] =
    await Promise.all([
      db
        .select({ id: clientes.id, nombre: clientes.razon_social })
        .from(clientes)
        .orderBy(asc(clientes.razon_social)),
      db
        .select({ id: choferes.id, nombre: choferes.nombre_completo })
        .from(choferes)
        .orderBy(asc(choferes.nombre_completo)),
      db
        .select({ id: camiones.id, nombre: camiones.dominio_tractor })
        .from(camiones)
        .orderBy(asc(camiones.dominio_tractor)),
      db
        .select({ id: productos.id, nombre: productos.nombre })
        .from(productos)
        .orderBy(asc(productos.nombre)),
      db.select({ id: lugares.id, nombre: lugares.nombre }).from(lugares).orderBy(asc(lugares.nombre)),
    ]);

  const baseConteo = db.select({ n: count() }).from(viajes);
  const baseFilas = consultaViajes();

  const [filas, filasConteo] = await Promise.all([
    (where ? baseFilas.where(where) : baseFilas)
      .orderBy(orden)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    where ? baseConteo.where(where) : baseConteo,
  ]);
  const total = filasConteo[0]?.n ?? 0;

  const paramsExport = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v == null ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]]
    )
  ).toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Viajes</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/api/viajes/exportar${paramsExport ? `?${paramsExport}` : ""}`}>
              Exportar CSV
            </a>
          </Button>
          <Button asChild>
            <Link href="/viajes/nuevo">Nuevo viaje</Link>
          </Button>
        </div>
      </div>

      <BarraFiltros
        clientes={filasClientes}
        choferes={filasChoferes}
        camiones={filasCamiones}
        productos={filasProductos}
        lugares={filasLugares}
      />

      <TablaViajes
        filas={filas}
        sort={typeof sp.sort === "string" ? sp.sort : undefined}
        dir={typeof sp.dir === "string" ? sp.dir : undefined}
      />

      <Paginacion page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
