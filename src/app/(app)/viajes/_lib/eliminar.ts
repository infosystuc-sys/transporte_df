import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { adjuntos, cobroImputaciones, viajes } from "@/db/schema";
import { eliminarAdjunto } from "@/lib/supabase/storage";

/**
 * Los gastos, adicionales y contingencias del viaje se borran solos (FK en
 * cascada), pero si ya tiene un cobro imputado o entró en una liquidación
 * no se deja borrar -- son registros contables que ya salieron del viaje
 * y romperían esos otros módulos. Los adjuntos no tienen FK real (la
 * tabla es polimórfica) así que hay que limpiarlos a mano, storage
 * incluido, o quedan huérfanos apuntando a un viaje que ya no existe.
 */
export async function borrarViaje(id: number): Promise<{ error?: string } | void> {
  const [viaje] = await db.select({ liquidado: viajes.liquidado }).from(viajes).where(eq(viajes.id, id));
  if (!viaje) return;

  if (viaje.liquidado) {
    return { error: "No se puede eliminar: el viaje ya está liquidado. Sacalo de la liquidación primero." };
  }

  const [imputacion] = await db
    .select({ id: cobroImputaciones.id })
    .from(cobroImputaciones)
    .where(eq(cobroImputaciones.viaje_id, id))
    .limit(1);
  if (imputacion) {
    return { error: "No se puede eliminar: el viaje ya tiene un cobro imputado. Corregí el cobro primero." };
  }

  const filasAdjuntos = await db
    .select({ storage_path: adjuntos.storage_path })
    .from(adjuntos)
    .where(and(eq(adjuntos.entidad, "viaje"), eq(adjuntos.entidad_id, id)));
  for (const a of filasAdjuntos) {
    await eliminarAdjunto(a.storage_path).catch(() => {});
  }
  await db.delete(adjuntos).where(and(eq(adjuntos.entidad, "viaje"), eq(adjuntos.entidad_id, id)));

  await db.delete(viajes).where(eq(viajes.id, id));
}
