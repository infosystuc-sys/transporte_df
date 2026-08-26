"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { liquidacionesChofer, liquidacionViajes, movimientosChofer, viajes } from "@/db/schema";
import { crearLiquidacionSchema, type CrearLiquidacionInput } from "@/lib/schemas/liquidaciones";
import { signoTipoMovimiento } from "@/lib/cuenta-corriente/signo";
import { avanzarEstadoAutomatico } from "../viajes/_lib/avance-estado";

export async function crearLiquidacion(
  valores: CrearLiquidacionInput
): Promise<{ error?: string } | void> {
  const datos = crearLiquidacionSchema.parse(valores);

  if (datos.viajes.length === 0 && datos.movimientos.length === 0) {
    return { error: "Elegí al menos un viaje o un movimiento pendiente para liquidar." };
  }

  const totalViajesImporte = datos.viajes.reduce((s, v) => s + Number(v.importe), 0);

  const movimientosSeleccionados =
    datos.movimientos.length > 0
      ? await db
          .select()
          .from(movimientosChofer)
          .where(
            inArray(
              movimientosChofer.id,
              datos.movimientos.map((m) => m.movimiento_id)
            )
          )
      : [];

  // Deducciones pendientes (adelanto/gasoil/ajuste/devolución) vs créditos
  // pendientes (gasto_rendido) que se saldan junto con esta liquidación.
  const totalAdelantos = movimientosSeleccionados
    .filter((m) => signoTipoMovimiento(m.tipo) < 0)
    .reduce((s, m) => s + Number(m.importe), 0);
  const totalCreditos = movimientosSeleccionados
    .filter((m) => signoTipoMovimiento(m.tipo) > 0)
    .reduce((s, m) => s + Number(m.importe), 0);
  const totalNeto = totalViajesImporte + totalCreditos - totalAdelantos;

  let liquidacionId!: number;

  await db.transaction(async (tx) => {
    const [liq] = await tx
      .insert(liquidacionesChofer)
      .values({
        chofer_id: datos.cabecera.chofer_id,
        fecha: datos.cabecera.fecha,
        periodo_desde: datos.cabecera.periodo_desde ?? null,
        periodo_hasta: datos.cabecera.periodo_hasta ?? null,
        total_viajes: datos.viajes.length,
        total_adelantos: totalAdelantos.toFixed(2),
        total_neto: totalNeto.toFixed(2),
        pagado: false,
        medio_pago_id: datos.cabecera.medio_pago_id ?? null,
        observaciones: datos.cabecera.observaciones,
      })
      .returning({ id: liquidacionesChofer.id });
    liquidacionId = liq.id;

    if (datos.viajes.length > 0) {
      await tx.insert(liquidacionViajes).values(
        datos.viajes.map((v) => ({
          liquidacion_id: liq.id,
          viaje_id: v.viaje_id,
          importe: v.importe,
        }))
      );
      await tx
        .update(viajes)
        .set({ liquidado: true, liquidacion_id: liq.id })
        .where(
          inArray(
            viajes.id,
            datos.viajes.map((v) => v.viaje_id)
          )
        );
    }

    if (movimientosSeleccionados.length > 0) {
      await tx
        .update(movimientosChofer)
        .set({ liquidacion_id: liq.id })
        .where(
          inArray(
            movimientosChofer.id,
            movimientosSeleccionados.map((m) => m.id)
          )
        );
    }

    // Registra en la cuenta corriente lo ganado en los viajes incluidos —
    // los movimientos ya existentes (adelantos, gastos rendidos) solo se
    // marcan como saldados arriba, no se duplican acá.
    if (totalViajesImporte > 0) {
      await tx.insert(movimientosChofer).values({
        fecha: datos.cabecera.fecha,
        chofer_id: datos.cabecera.chofer_id,
        tipo: "liquidacion",
        importe: totalViajesImporte.toFixed(2),
        origen_automatico: true,
        liquidacion_id: liq.id,
        descripcion: `Liquidación #${liq.id}`,
      });
    }
  });

  for (const v of datos.viajes) {
    await avanzarEstadoAutomatico(v.viaje_id);
  }

  revalidatePath("/liquidaciones");
  revalidatePath(`/choferes/${datos.cabecera.chofer_id}`);
  revalidatePath("/viajes");
  redirect(`/liquidaciones/${liquidacionId}`);
}

export async function marcarLiquidacionPagada(
  id: number,
  medioPagoId?: number
): Promise<{ error?: string } | void> {
  await db
    .update(liquidacionesChofer)
    .set({ pagado: true, ...(medioPagoId ? { medio_pago_id: medioPagoId } : {}) })
    .where(eq(liquidacionesChofer.id, id));
  revalidatePath(`/liquidaciones/${id}`);
  revalidatePath("/liquidaciones");
}

/** Deshace una liquidación no pagada: libera viajes y movimientos, la borra. */
export async function eliminarLiquidacion(id: number): Promise<{ error?: string } | void> {
  const [liq] = await db.select().from(liquidacionesChofer).where(eq(liquidacionesChofer.id, id));
  if (!liq) return { error: "Liquidación no encontrada." };
  if (liq.pagado) return { error: "No se puede eliminar una liquidación ya pagada." };

  await db.transaction(async (tx) => {
    await tx
      .update(viajes)
      .set({ liquidado: false, liquidacion_id: null })
      .where(eq(viajes.liquidacion_id, id));
    // El movimiento de tipo "liquidacion" que generó esta liquidación se
    // borra (era nuevo, nació con ella); los demás movimientos que solo
    // quedaron marcados como saldados (adelantos, gastos rendidos previos)
    // se liberan para volver a aparecer como pendientes, no se borran.
    await tx
      .delete(movimientosChofer)
      .where(and(eq(movimientosChofer.liquidacion_id, id), eq(movimientosChofer.tipo, "liquidacion")));
    await tx
      .update(movimientosChofer)
      .set({ liquidacion_id: null })
      .where(eq(movimientosChofer.liquidacion_id, id));
    await tx.delete(liquidacionesChofer).where(eq(liquidacionesChofer.id, id));
  });

  revalidatePath("/liquidaciones");
  revalidatePath(`/choferes/${liq.chofer_id}`);
  revalidatePath("/viajes");
}
