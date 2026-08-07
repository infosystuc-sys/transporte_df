import { eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, productos } from "@/db/schema";
import { buscarLugarPorNombre } from "@/lib/lugares/buscar";
import type { CpeExtraido } from "./parser";

export type Coincidencias = {
  titular_id: number | null;
  destinatario_id: number | null;
  pagador_id: number | null;
  chofer_id: number | null;
  camion_id: number | null;
  producto_id: number | null;
  origen_id: number | null;
  destino_id: number | null;
};

function limpiarCuit(cuit: string) {
  return cuit.replace(/[^0-9]/g, "");
}

async function buscarClientePorCuit(cuit: string | null) {
  if (!cuit) return null;
  const [fila] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.cuit, limpiarCuit(cuit)));
  return fila?.id ?? null;
}

export async function buscarCoincidencias(cpe: CpeExtraido): Promise<Coincidencias> {
  const [titular_id, destinatario_id, pagador_id] = await Promise.all([
    buscarClientePorCuit(cpe.titular_cuit),
    buscarClientePorCuit(cpe.destinatario_cuit),
    buscarClientePorCuit(cpe.pagador_cuit),
  ]);

  const [chofer] = cpe.chofer_cuil
    ? await db.select({ id: choferes.id }).from(choferes).where(eq(choferes.cuil, limpiarCuit(cpe.chofer_cuil)))
    : [];

  const [camion] = cpe.dominio_tractor
    ? await db
        .select({ id: camiones.id })
        .from(camiones)
        .where(ilike(camiones.dominio_tractor, cpe.dominio_tractor))
    : [];

  const [producto] = cpe.producto_nombre
    ? await db.select({ id: productos.id }).from(productos).where(ilike(productos.nombre, cpe.producto_nombre))
    : [];

  const [origen_id, destino_id] = await Promise.all([
    buscarLugarPorNombre(cpe.origen_localidad),
    buscarLugarPorNombre(cpe.destino_localidad),
  ]);

  return {
    titular_id,
    destinatario_id,
    pagador_id,
    chofer_id: chofer?.id ?? null,
    camion_id: camion?.id ?? null,
    producto_id: producto?.id ?? null,
    origen_id,
    destino_id,
  };
}
