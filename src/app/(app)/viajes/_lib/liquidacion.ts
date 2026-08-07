import { eq } from "drizzle-orm";
import { db } from "@/db";
import { choferes, viajes } from "@/db/schema";

/**
 * Recalcula importe_liquidacion_chofer según la modalidad de pago del
 * chofer asignado (spec 1: 15% del flete por defecto, configurable por
 * chofer). Se corre después de guardar Datos generales (cambio de chofer),
 * Carga/Descarga (cambia el neto destino) o Tarifa/Adicionales (cambia el
 * importe_flete) — cualquiera de esos cambios puede alterar el resultado.
 *
 * Un viaje ya incluido en una liquidación (liquidado = true) no se toca
 * más: el importe queda fijo como snapshot histórico de lo que se pagó.
 */
export async function recalcularLiquidacionChofer(viajeId: number) {
  const [viaje] = await db.select().from(viajes).where(eq(viajes.id, viajeId));
  if (!viaje || viaje.liquidado) return;

  if (!viaje.chofer_id) {
    await db
      .update(viajes)
      .set({ importe_liquidacion_chofer: null })
      .where(eq(viajes.id, viajeId));
    return;
  }

  const [chofer] = await db.select().from(choferes).where(eq(choferes.id, viaje.chofer_id));
  if (!chofer) return;

  let importe: number | null = null;
  switch (chofer.modalidad_pago) {
    case "porcentaje_flete":
      if (viaje.importe_flete != null) {
        importe = Number(viaje.importe_flete) * (Number(chofer.valor_pago) / 100);
      }
      break;
    case "monto_fijo_viaje":
      importe = Number(chofer.valor_pago);
      break;
    case "por_tonelada":
      if (viaje.neto_destino != null) {
        importe = Number(chofer.valor_pago) * (Number(viaje.neto_destino) / 1000);
      }
      break;
    case "sueldo":
    case "sin_definir":
    default:
      importe = null;
  }

  await db
    .update(viajes)
    .set({ importe_liquidacion_chofer: importe != null ? importe.toFixed(2) : null })
    .where(eq(viajes.id, viajeId));
}
