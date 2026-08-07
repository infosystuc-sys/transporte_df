import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, configuracion, productos, viajes } from "@/db/schema";

const TOLERANCIA_POR_DEFECTO = "0.5";

/**
 * Recalcula merma_kg, merma_pct, tolerancia_pct_aplicada,
 * merma_excede_tolerancia y merma_importe de un viaje a partir de sus pesos
 * netos actuales. Solo calcula si están cargados neto_origen y
 * neto_destino (spec 4.2); si falta alguno, limpia los campos derivados.
 *
 * Se llama después de guardar Carga o Descarga, porque cualquiera de las
 * dos puede ser la que complete el par de netos.
 */
export async function recalcularMerma(viajeId: number) {
  const [viaje] = await db.select().from(viajes).where(eq(viajes.id, viajeId));
  if (!viaje) return;

  if (!viaje.neto_origen || !viaje.neto_destino) {
    await db
      .update(viajes)
      .set({ merma_kg: null, merma_pct: null, merma_excede_tolerancia: false })
      .where(eq(viajes.id, viajeId));
    return;
  }

  const netoOrigen = Number(viaje.neto_origen);
  const netoDestino = Number(viaje.neto_destino);
  const mermaKg = netoOrigen - netoDestino;
  const mermaPct = netoOrigen > 0 ? (mermaKg / netoOrigen) * 100 : 0;

  // Tolerancia: la del cliente si está definida; si no, la global.
  let tolerancia = TOLERANCIA_POR_DEFECTO;
  const [cliente] = viaje.cliente_id
    ? await db.select().from(clientes).where(eq(clientes.id, viaje.cliente_id))
    : [];
  if (cliente?.tolerancia_merma_pct != null) {
    tolerancia = cliente.tolerancia_merma_pct;
  } else {
    const [config] = await db.select().from(configuracion).limit(1);
    if (config?.tolerancia_merma_pct != null) tolerancia = config.tolerancia_merma_pct;
  }

  const excede = mermaPct > Number(tolerancia);

  // Valorización: si todavía no se cargó un precio a mano, se precarga con
  // el precio de referencia del producto. Es solo informativo.
  let precioUnitario = viaje.merma_precio_unitario;
  if (precioUnitario == null && viaje.producto_id) {
    const [producto] = await db.select().from(productos).where(eq(productos.id, viaje.producto_id));
    precioUnitario = producto?.precio_referencia ?? null;
  }
  const mermaImporte = precioUnitario != null ? (mermaKg / 1000) * Number(precioUnitario) : null;

  await db
    .update(viajes)
    .set({
      merma_kg: mermaKg.toFixed(2),
      merma_pct: mermaPct.toFixed(3),
      tolerancia_pct_aplicada: tolerancia,
      merma_excede_tolerancia: excede,
      merma_precio_unitario: precioUnitario,
      merma_importe: mermaImporte != null ? mermaImporte.toFixed(2) : null,
    })
    .where(eq(viajes.id, viajeId));
}
