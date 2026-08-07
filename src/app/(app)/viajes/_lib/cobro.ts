import { eq } from "drizzle-orm";
import { db } from "@/db";
import { condicionesPago, cobroImputaciones, viajes } from "@/db/schema";

/**
 * Recalcula fecha_vto_cobro (factura_fecha + días de la condición),
 * importe_cobrado (suma de imputaciones) y saldo_pendiente (spec 3.2). Se
 * llama al guardar Facturación, al pasar el viaje a "facturado" y al
 * crear/eliminar una imputación de cobro.
 */
export async function recalcularCobro(viajeId: number) {
  const [viaje] = await db.select().from(viajes).where(eq(viajes.id, viajeId));
  if (!viaje) return;

  let fechaVtoCobro: Date | null = null;
  if (viaje.factura_fecha && viaje.condicion_pago_id) {
    const [condicion] = await db
      .select()
      .from(condicionesPago)
      .where(eq(condicionesPago.id, viaje.condicion_pago_id));
    if (condicion?.dias != null) {
      fechaVtoCobro = new Date(viaje.factura_fecha);
      fechaVtoCobro.setDate(fechaVtoCobro.getDate() + condicion.dias);
    }
  }

  const imputaciones = await db
    .select()
    .from(cobroImputaciones)
    .where(eq(cobroImputaciones.viaje_id, viajeId));
  const importeCobrado = imputaciones.reduce((s, i) => s + Number(i.importe_imputado), 0);

  const montoAFacturar =
    viaje.factura_importe_total != null
      ? Number(viaje.factura_importe_total)
      : viaje.total_a_cobrar != null
        ? Number(viaje.total_a_cobrar)
        : null;
  const saldoPendiente = montoAFacturar != null ? montoAFacturar - importeCobrado : null;

  await db
    .update(viajes)
    .set({
      fecha_vto_cobro: fechaVtoCobro,
      importe_cobrado: importeCobrado.toFixed(2),
      saldo_pendiente: saldoPendiente != null ? saldoPendiente.toFixed(2) : null,
    })
    .where(eq(viajes.id, viajeId));
}
