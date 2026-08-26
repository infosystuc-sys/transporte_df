import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cobroImputaciones, viajes } from "@/db/schema";
import { ESTADOS_ORDEN } from "./estados";

const idx = (estado: (typeof ESTADOS_ORDEN)[number]) => ESTADOS_ORDEN.indexOf(estado);

/**
 * Automatiza el stepper de estado (spec: antes solo avanzaba con un clic
 * manual en "Avanzar", viaje por viaje). Se llama después de guardar
 * cualquier pestaña que pueda cumplir el requisito del próximo paso —
 * mira los datos que el viaje YA tiene (no cuál acción se acaba de
 * llamar) y salta directo al estado más avanzado que esos datos
 * habilitan, sin depender de haber pasado por los pasos intermedios a
 * mano. Nunca retrocede, y nunca toca "rechazado" (estado terminal
 * alternativo, 100% manual vía su propio botón). El stepper manual
 * (Avanzar/Retroceder) sigue funcionando igual que antes, para casos
 * excepcionales -- esto solo evita depender de él en el flujo normal.
 */
export async function avanzarEstadoAutomatico(viajeId: number) {
  const [viaje] = await db.select().from(viajes).where(eq(viajes.id, viajeId));
  if (!viaje) return;

  const idxActual = idx(viaje.estado as (typeof ESTADOS_ORDEN)[number]);
  if (idxActual === -1) return; // "rechazado" no está en ESTADOS_ORDEN -- no se toca.

  let idxObjetivo = idxActual;

  // "en_transito" en vez de pararse en "cargado": no hay ningún dato
  // propio que distinga un estado del otro (los dos dependen de la misma
  // fecha_partida), así que frenar en "cargado" solo obligaría a un clic
  // manual extra sin aportar información nueva.
  if (viaje.fecha_partida) idxObjetivo = Math.max(idxObjetivo, idx("en_transito"));
  if (viaje.fecha_descarga) idxObjetivo = Math.max(idxObjetivo, idx("descargado"));
  if (viaje.factura_nro) idxObjetivo = Math.max(idxObjetivo, idx("facturado"));
  if (viaje.liquidado) idxObjetivo = Math.max(idxObjetivo, idx("liquidado"));

  // "cobrado" no sale de un campo simple del viaje -- depende de que
  // tenga al menos un cobro imputado.
  const [imputacion] = await db
    .select({ id: cobroImputaciones.id })
    .from(cobroImputaciones)
    .where(eq(cobroImputaciones.viaje_id, viajeId))
    .limit(1);
  if (imputacion) idxObjetivo = Math.max(idxObjetivo, idx("cobrado"));

  // El stepper manual, al pasar a "facturado", además prende el booleano
  // separado viajes.facturado (lo usan el dashboard, Nuevo cobro y las
  // alertas para filtrar "viajes ya facturados" -- estado='facturado' no
  // alcanza para esas consultas). Se chequea aparte de idxObjetivo >
  // idxActual: si por lo que sea el viaje ya está en "facturado" o más
  // adelante pero esta columna quedó sin actualizar, también se corrige
  // acá (no solo cuando hay un avance de estado nuevo en esta llamada).
  const debeEstarFacturado = idxObjetivo >= idx("facturado");
  const cambios: Partial<typeof viajes.$inferInsert> = {};
  if (idxObjetivo > idxActual) cambios.estado = ESTADOS_ORDEN[idxObjetivo];
  if (debeEstarFacturado && !viaje.facturado) cambios.facturado = true;
  if (Object.keys(cambios).length === 0) return;

  await db
    .update(viajes)
    .set({ ...cambios, actualizado_en: new Date() })
    .where(eq(viajes.id, viajeId));
}
