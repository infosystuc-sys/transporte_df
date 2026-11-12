"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adjuntos, camiones, cargasGasoil } from "@/db/schema";
import { cargaGasoilSchema, type CargaGasoilInput } from "@/lib/schemas/gasoil";
import { insertarCargaGasoil } from "@/lib/gasoil/insertar";
import { subirAdjunto } from "@/lib/supabase/storage";

const RUTA = "/gasoil";

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
