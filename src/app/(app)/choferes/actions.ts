"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { choferes, movimientosChofer } from "@/db/schema";
import { choferSchema, type ChoferInput } from "@/lib/schemas/flota";
import { movimientoManualSchema, type MovimientoManualInput } from "@/lib/schemas/choferes-cuenta";
import { esErrorReferenciado } from "@/lib/db/errores";

const RUTA = "/choferes";

export async function crearChofer(valores: ChoferInput) {
  const datos = choferSchema.parse(valores);
  await db.insert(choferes).values(datos);
  revalidatePath(RUTA);
}

export async function actualizarChofer(id: number, valores: ChoferInput) {
  const datos = choferSchema.parse(valores);
  await db.update(choferes).set(datos).where(eq(choferes.id, id));
  revalidatePath(RUTA);
}

export async function eliminarChofer(id: number) {
  try {
    await db.delete(choferes).where(eq(choferes.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) {
      return { error: "No se puede eliminar: tiene viajes o movimientos asociados." };
    }
    throw error;
  }
  revalidatePath(RUTA);
}

export async function crearMovimientoManual(
  choferId: number,
  valores: MovimientoManualInput
): Promise<{ error?: string } | void> {
  const datos = movimientoManualSchema.parse(valores);
  await db.insert(movimientosChofer).values({ ...datos, chofer_id: choferId, origen_automatico: false });
  revalidatePath(`${RUTA}/${choferId}`);
}
