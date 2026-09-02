import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, estacionesServicio, viajes } from "@/db/schema";

export type OpcionGasoil = { id: number; nombre: string };

export type CatalogosGasoil = {
  camiones: OpcionGasoil[];
  choferes: OpcionGasoil[];
  estaciones: OpcionGasoil[];
  viajes: OpcionGasoil[];
};

/**
 * Mismo catálogo que ya arma /gasoil (page.tsx) para el ABM -- extraído
 * acá para que /gasoil-masivo lo reutilice sin duplicar las cuatro
 * consultas.
 */
export async function obtenerCatalogosGasoil(): Promise<CatalogosGasoil> {
  const [filasCamiones, filasChoferes, filasEstaciones, filasViajes] = await Promise.all([
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
    db
      .select({ id: viajes.id, numero: viajes.numero })
      .from(viajes)
      .where(eq(viajes.liquidado, false))
      .orderBy(desc(viajes.numero)),
  ]);

  return {
    camiones: filasCamiones,
    choferes: filasChoferes,
    estaciones: filasEstaciones,
    viajes: filasViajes.map((v) => ({ id: v.id, nombre: `#${v.numero}` })),
  };
}
