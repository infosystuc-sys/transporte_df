"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { camiones } from "@/db/schema";
import { camionSchema, type CamionInput } from "@/lib/schemas/flota";
import { esErrorReferenciado } from "@/lib/db/errores";

const RUTA = "/camiones";

export async function crearCamion(valores: CamionInput) {
  const datos = camionSchema.parse(valores);
  await db.insert(camiones).values(datos);
  revalidatePath(RUTA);
}

export async function actualizarCamion(id: number, valores: CamionInput) {
  const datos = camionSchema.parse(valores);
  await db.update(camiones).set(datos).where(eq(camiones.id, id));
  revalidatePath(RUTA);
}

export async function eliminarCamion(id: number) {
  try {
    await db.delete(camiones).where(eq(camiones.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) {
      return { error: "No se puede eliminar: tiene viajes o cargas de gasoil asociadas." };
    }
    throw error;
  }
  revalidatePath(RUTA);
}
