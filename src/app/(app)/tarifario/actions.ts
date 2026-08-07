"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tarifas } from "@/db/schema";
import { tarifaSchema, type TarifaInput } from "@/lib/schemas/tarifas";

const RUTA = "/tarifario";

export async function crearTarifa(valores: TarifaInput) {
  const datos = tarifaSchema.parse(valores);
  await db.insert(tarifas).values(datos);
  revalidatePath(RUTA);
}

export async function actualizarTarifa(id: number, valores: TarifaInput) {
  const datos = tarifaSchema.parse(valores);
  await db.update(tarifas).set(datos).where(eq(tarifas.id, id));
  revalidatePath(RUTA);
}

export async function eliminarTarifa(id: number) {
  await db.delete(tarifas).where(eq(tarifas.id, id));
  revalidatePath(RUTA);
}
