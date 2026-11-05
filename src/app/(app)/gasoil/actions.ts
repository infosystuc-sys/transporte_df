"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { adjuntos, camiones, cargasGasoil, estacionesServicio, viajes } from "@/db/schema";
import { cargaGasoilSchema, type CargaGasoilInput } from "@/lib/schemas/gasoil";
import { registrarMovimientoAutomatico } from "@/lib/cuenta-corriente/movimientos";
import { subirAdjunto } from "@/lib/supabase/storage";

const RUTA = "/gasoil";

/**
 * El último viaje hecho por el chofer (o, si la carga no tiene chofer,
 * por el camión) hasta el día de la carga. Pedido de David: cada
 * comprobante de gasoil que se sube queda asociado a ese viaje, así se
 * puede responder "¿cuánto gasoil usó el camión X en el viaje del día Y?".
 */
async function ultimoViajeHasta(datos: { fecha: Date; chofer_id?: number | null; camion_id: number }) {
  const fechaViaje = sql`coalesce(${viajes.fecha_carga}, ${viajes.fecha_partida}, ${viajes.cpe_fecha_emision}, ${viajes.creado_en})`;
  // Hasta el final del día de la carga (la fecha llega sin hora).
  const tope = new Date(datos.fecha.getTime() + 36 * 3600 * 1000);
  const filtroQuien = datos.chofer_id ? eq(viajes.chofer_id, datos.chofer_id) : eq(viajes.camion_id, datos.camion_id);
  const [viaje] = await db
    .select({ id: viajes.id })
    .from(viajes)
    .where(and(filtroQuien, ne(viajes.estado, "planificado"), sql`${fechaViaje} <= ${tope.toISOString()}::timestamptz`))
    .orderBy(desc(fechaViaje), desc(viajes.id))
    .limit(1);
  return viaje?.id ?? null;
}

/** Inserta la carga y aplica los efectos secundarios (odómetro, cuenta
 * corriente del chofer). Devuelve el id — lo usan tanto el alta manual
 * como el alta con comprobante adjunto para no duplicar esta lógica. */
async function insertarCargaGasoil(entrada: ReturnType<typeof cargaGasoilSchema.parse>) {
  // Si no se eligió a qué viaje corresponde, va al último viaje del chofer o camión.
  const datos = entrada.viaje_id ? entrada : { ...entrada, viaje_id: await ultimoViajeHasta(entrada) };
  const [carga] = await db.insert(cargasGasoil).values(datos).returning({ id: cargasGasoil.id });

  const [camion] = await db.select().from(camiones).where(eq(camiones.id, datos.camion_id));
  if (
    camion &&
    datos.odometro != null &&
    (camion.odometro_actual == null || datos.odometro > camion.odometro_actual)
  ) {
    await db.update(camiones).set({ odometro_actual: datos.odometro }).where(eq(camiones.id, datos.camion_id));
  }

  // El schema exige importe cuando modalidad = pagado_por_chofer, así que
  // acá siempre está presente — el chequeo es solo para conformar a TS.
  if (datos.modalidad === "pagado_por_chofer" && datos.chofer_id && datos.importe) {
    const [estacion] = datos.estacion_id
      ? await db.select().from(estacionesServicio).where(eq(estacionesServicio.id, datos.estacion_id))
      : [];
    await registrarMovimientoAutomatico({
      chofer_id: datos.chofer_id,
      tipo: "gasto_rendido",
      importe: datos.importe,
      viaje_id: datos.viaje_id,
      descripcion: `Gasoil${estacion ? ` en ${estacion.nombre}` : ""} (${datos.litros} L)`,
    });
  }

  return carga.id;
}

export async function crearCargaGasoil(valores: CargaGasoilInput): Promise<{ error?: string } | void> {
  const datos = cargaGasoilSchema.parse(valores);
  await insertarCargaGasoil(datos);
  revalidatePath(RUTA);
}

/**
 * Igual que crearCargaGasoil, pero además guarda el archivo del
 * comprobante (subido para la carga por IA) como adjunto de la carga —
 * nunca se pierde el original aunque los datos se hayan extraído
 * automáticamente.
 */
export async function crearCargaGasoilConAdjunto(
  formData: FormData
): Promise<{ error?: string } | void> {
  const archivo = formData.get("archivo");
  const datosJson = formData.get("datos");
  if (!(archivo instanceof File) || typeof datosJson !== "string") {
    return { error: "Faltan datos." };
  }

  const datos = cargaGasoilSchema.parse(JSON.parse(datosJson) as CargaGasoilInput);
  const id = await insertarCargaGasoil(datos);

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const rutaStorage = `carga_gasoil/${id}/${randomUUID()}-${archivo.name}`;
  await subirAdjunto(rutaStorage, buffer, archivo.type || "application/octet-stream");
  await db.insert(adjuntos).values({
    entidad: "carga_gasoil",
    entidad_id: id,
    tipo: "comprobante",
    nombre_archivo: archivo.name,
    storage_path: rutaStorage,
  });

  revalidatePath(RUTA);
}

export async function actualizarCargaGasoil(
  id: number,
  valores: CargaGasoilInput
): Promise<{ error?: string } | void> {
  const datos = cargaGasoilSchema.parse(valores);
  await db.update(cargasGasoil).set(datos).where(eq(cargasGasoil.id, id));

  const [camion] = await db.select().from(camiones).where(eq(camiones.id, datos.camion_id));
  if (
    camion &&
    datos.odometro != null &&
    (camion.odometro_actual == null || datos.odometro > camion.odometro_actual)
  ) {
    await db.update(camiones).set({ odometro_actual: datos.odometro }).where(eq(camiones.id, datos.camion_id));
  }

  revalidatePath(RUTA);
}

export async function eliminarCargaGasoil(id: number): Promise<{ error?: string } | void> {
  await db.delete(cargasGasoil).where(eq(cargasGasoil.id, id));
  revalidatePath(RUTA);
}
