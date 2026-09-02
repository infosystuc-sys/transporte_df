import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { cargasGasoil } from "@/db/schema";
import { obtenerCatalogosGasoil } from "@/lib/gasoil/datos-catalogos";
import { Button } from "@/components/ui/button";
import { GestorGasoil } from "./_componentes/gestor-gasoil";
import { FiltrosGasoil } from "./_componentes/filtros-gasoil";
import { PanelRendimiento } from "./_componentes/panel-rendimiento";

export const metadata: Metadata = {
  title: "Gasoil — Gestión de Fletes",
};

export default async function GasoilPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const camionId = typeof sp.camion_id === "string" ? Number(sp.camion_id) : undefined;
  const estacionId = typeof sp.estacion_id === "string" ? Number(sp.estacion_id) : undefined;
  const fechaDesde = typeof sp.fecha_desde === "string" ? sp.fecha_desde : undefined;
  const fechaHasta = typeof sp.fecha_hasta === "string" ? sp.fecha_hasta : undefined;

  const condiciones: SQL[] = [];
  if (camionId) condiciones.push(eq(cargasGasoil.camion_id, camionId));
  if (estacionId) condiciones.push(eq(cargasGasoil.estacion_id, estacionId));
  if (fechaDesde) condiciones.push(gte(cargasGasoil.fecha, new Date(fechaDesde)));
  if (fechaHasta) condiciones.push(lte(cargasGasoil.fecha, new Date(fechaHasta)));
  const where = condiciones.length ? and(...condiciones) : undefined;

  const [catalogos, filasCargas] = await Promise.all([
    obtenerCatalogosGasoil(),
    (where
      ? db.select().from(cargasGasoil).where(where)
      : db.select().from(cargasGasoil)
    ).orderBy(desc(cargasGasoil.fecha)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Gasoil</h1>
        <Button variant="outline" asChild>
          <Link href="/gasoil-masivo">Cargar varios comprobantes</Link>
        </Button>
      </div>

      <FiltrosGasoil camiones={catalogos.camiones} estaciones={catalogos.estaciones} />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Rendimiento (según los filtros aplicados)
        </h2>
        <PanelRendimiento cargas={filasCargas} camiones={catalogos.camiones} />
      </div>

      <GestorGasoil
        filas={filasCargas}
        camiones={catalogos.camiones}
        choferes={catalogos.choferes}
        estaciones={catalogos.estaciones}
        viajes={catalogos.viajes}
      />
    </div>
  );
}
