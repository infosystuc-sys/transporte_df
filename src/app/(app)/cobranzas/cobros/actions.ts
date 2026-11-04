"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { cobroImputaciones, cobros, liquidoProductoCobros, liquidosProducto, mediosPago, retencionesCobro } from "@/db/schema";
import { crearCobroSchema, type CrearCobroInput } from "@/lib/schemas/cobros";
import { camposFaltantesEcheq, clasificarMedioPago } from "@/lib/cobros/medio-pago";
import { recalcularCobro } from "../../viajes/_lib/cobro";
import { avanzarEstadoAutomatico } from "../../viajes/_lib/avance-estado";

export async function crearCobro(valores: CrearCobroInput): Promise<{ error?: string } | void> {
  const datos = crearCobroSchema.parse(valores);

  const [medio] = await db
    .select({ nombre: mediosPago.nombre })
    .from(mediosPago)
    .where(eq(mediosPago.id, datos.cabecera.medio_pago_id));
  if (clasificarMedioPago(medio?.nombre) === "echeq") {
    const faltantes = camposFaltantesEcheq(datos.cabecera);
    if (faltantes.length > 0) return { error: faltantes.map((f) => f.mensaje).join(" ") };
  }

  const totalImputado = datos.imputaciones.reduce((s, i) => s + Number(i.importe_imputado), 0);
  if (totalImputado > Number(datos.cabecera.importe)) {
    return { error: "El total imputado no puede superar el importe del cobro." };
  }

  await db.transaction(async (tx) => {
    const [cobro] = await tx.insert(cobros).values(datos.cabecera).returning({ id: cobros.id });

    if (datos.imputaciones.length > 0) {
      await tx.insert(cobroImputaciones).values(
        datos.imputaciones.map((i) => ({
          cobro_id: cobro.id,
          viaje_id: i.viaje_id,
          importe_imputado: i.importe_imputado,
        }))
      );
    }

    if (datos.retenciones.length > 0) {
      await tx.insert(retencionesCobro).values(
        datos.retenciones.map((r) => ({ ...r, cobro_id: cobro.id }))
      );
    }
  });

  for (const i of datos.imputaciones) {
    await recalcularCobro(i.viaje_id);
    await avanzarEstadoAutomatico(i.viaje_id);
  }

  revalidatePath("/cobranzas");
  revalidatePath("/cobranzas/cobros");
  revalidatePath("/viajes");
  redirect("/cobranzas/cobros");
}

export async function eliminarCobro(id: number): Promise<{ error?: string } | void> {
  const viajesAfectados = await db
    .select({ viaje_id: cobroImputaciones.viaje_id })
    .from(cobroImputaciones)
    .where(eq(cobroImputaciones.cobro_id, id));

  // Si el cobro era el pago de un líquido producto, el LP vuelve a quedar
  // pendiente: sin eso seguiría figurando pagado sin ningún cobro detrás.
  const lps = await db
    .select({ id: liquidoProductoCobros.liquido_producto_id })
    .from(liquidoProductoCobros)
    .where(eq(liquidoProductoCobros.cobro_id, id));
  if (lps.length > 0) {
    await db
      .update(liquidosProducto)
      .set({ pagado: false, fecha_pago: null, actualizado_en: new Date() })
      .where(inArray(liquidosProducto.id, lps.map((l) => l.id)));
  }

  await db.delete(cobros).where(eq(cobros.id, id));

  for (const v of viajesAfectados) {
    await recalcularCobro(v.viaje_id);
  }
  revalidatePath("/cobranzas");
  revalidatePath("/cobranzas/cobros");
  revalidatePath("/viajes");
}
