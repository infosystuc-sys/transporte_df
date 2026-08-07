import type { Metadata } from "next";
import { and, asc, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { camiones, cargasGasoil, choferes, estacionesServicio } from "@/db/schema";
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

  const [filasCargas, filasCamiones, filasChoferes, filasEstaciones] = await Promise.all([
    (where
      ? db.select().from(cargasGasoil).where(where)
      : db.select().from(cargasGasoil)
    ).orderBy(desc(cargasGasoil.fecha)),
    db
      .select({ id: camiones.id, nombre: camiones.dominio_tractor })
      .from(camiones)
      .orderBy(asc(camiones.dominio_tractor)),
    db
      .select({ id: choferes.id, nombre: choferes.nombre_completo })
      .from(choferes)
      .orderBy(asc(choferes.nombre_completo)),
    db
      .select({ id: estacionesServicio.id, nombre: estacionesServicio.nombre })
      .from(estacionesServicio)
      .orderBy(asc(estacionesServicio.nombre)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Gasoil</h1>

      <FiltrosGasoil camiones={filasCamiones} estaciones={filasEstaciones} />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Rendimiento (según los filtros aplicados)
        </h2>
        <PanelRendimiento cargas={filasCargas} camiones={filasCamiones} />
      </div>

      <GestorGasoil
        filas={filasCargas}
        camiones={filasCamiones}
        choferes={filasChoferes}
        estaciones={filasEstaciones}
      />
    </div>
  );
}
