"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { choferes, movimientosChofer, viajes } from "@/db/schema";
import { choferSchema, type ChoferInput } from "@/lib/schemas/flota";
import { movimientoManualSchema, type MovimientoManualInput } from "@/lib/schemas/choferes-cuenta";
import { esErrorReferenciado } from "@/lib/db/errores";
import { recalcularLiquidacionChofer } from "../viajes/_lib/liquidacion";

const RUTA = "/choferes";

export async function crearChofer(valores: ChoferInput) {
  const datos = choferSchema.parse(valores);
  await db.insert(choferes).values(datos);
  revalidatePath(RUTA);
}

/**
 * Además de guardar la ficha, recalcula importe_liquidacion_chofer de los
 * viajes de este chofer todavía no liquidados (spec 1: la fórmula depende
 * de modalidad_pago/valor_pago del chofer). Sin esto, un chofer cargado
 * con la modalidad sin definir -- típico si se creó a mano o por CPE antes
 * de configurarle el %-- se queda con todos sus viajes en liquidación $0
 * para siempre aunque después se le complete el dato: recalcularLiquidacionChofer
 * solo se dispara al guardar el viaje, nunca al guardar el chofer.
 */
export async function actualizarChofer(id: number, valores: ChoferInput) {
  const datos = choferSchema.parse(valores);
  await db.update(choferes).set(datos).where(eq(choferes.id, id));

  const viajesPendientes = await db
    .select({ id: viajes.id })
    .from(viajes)
    .where(and(eq(viajes.chofer_id, id), eq(viajes.liquidado, false)));
  for (const v of viajesPendientes) {
    await recalcularLiquidacionChofer(v.id);
    revalidatePath(`/viajes/${v.id}`);
  }

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
