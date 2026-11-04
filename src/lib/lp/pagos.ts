import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  cobroImputaciones,
  cobros,
  liquidoProductoCobros,
  liquidoProductoLineas,
  liquidosProducto,
  mediosPago,
  viajes,
} from "@/db/schema";
import { camposFaltantesEcheq, clasificarMedioPago } from "@/lib/cobros/medio-pago";
import { recalcularCobro } from "@/app/(app)/viajes/_lib/cobro";
import { avanzarEstadoAutomatico } from "@/app/(app)/viajes/_lib/avance-estado";

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Ingresá una fecha válida." });
const opcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

export const pagoLpSchema = z.object({
  lp_ids: z.array(z.number().int()).min(1, { error: "Elegí al menos un líquido producto." }),
  fecha: fechaIso,
  /** N° de orden de pago. */
  referencia: opcional,
  observaciones: opcional,
  pagos: z
    .array(
      z.object({
        medio_pago_id: z.number({ error: "Elegí el medio de pago." }).int(),
        importe: z.number({ error: "Ingresá el importe." }).positive({ error: "El importe tiene que ser mayor a cero." }),
        banco: opcional,
        cheque_nro: opcional,
        cheque_vto: fechaIso.optional().or(z.literal("").transform(() => undefined)),
      })
    )
    .min(1, { error: "Cargá al menos un pago." }),
});
export type PagoLpInput = z.input<typeof pagoLpSchema>;

/** Mediodía en Argentina: así la fecha no cambia de día al mostrarla en ningún huso. */
const fechaAr = (iso: string) => new Date(`${iso}T12:00:00-03:00`);

/**
 * Marca uno o varios LP del mismo cliente como pagados. Cada pago (un
 * eCheq, una transferencia...) queda como un cobro de la app, imputado a
 * los viajes de esos LP en orden hasta cubrir su saldo; así la cuenta
 * corriente del cliente y el saldo de cada viaje quedan al día.
 */
export async function marcarLpPagados(entrada: PagoLpInput): Promise<{ error?: string; cobros?: number }> {
  const parseado = pagoLpSchema.safeParse(entrada);
  if (!parseado.success) return { error: parseado.error.issues[0]?.message ?? "Datos inválidos." };
  const datos = parseado.data;

  const lps = await db
    .select({ id: liquidosProducto.id, numero: liquidosProducto.numero, cliente_id: liquidosProducto.cliente_id, pagado: liquidosProducto.pagado })
    .from(liquidosProducto)
    .where(inArray(liquidosProducto.id, datos.lp_ids))
    .orderBy(asc(liquidosProducto.fecha), asc(liquidosProducto.id));
  if (lps.length !== new Set(datos.lp_ids).size) return { error: "Algún líquido producto ya no existe. Recargá la página." };
  if (new Set(lps.map((l) => l.cliente_id)).size > 1) return { error: "Los líquidos producto tienen que ser del mismo cliente." };
  const yaPagado = lps.find((l) => l.pagado);
  if (yaPagado) return { error: `El líquido producto ${yaPagado.numero} ya está marcado como pagado.` };

  const medios = await db.select({ id: mediosPago.id, nombre: mediosPago.nombre }).from(mediosPago);
  for (const [i, p] of datos.pagos.entries()) {
    const medio = medios.find((m) => m.id === p.medio_pago_id);
    if (!medio) return { error: `Pago ${i + 1}: el medio de pago no existe.` };
    if (clasificarMedioPago(medio.nombre) === "echeq") {
      const faltan = camposFaltantesEcheq(p);
      if (faltan.length > 0) return { error: `Pago ${i + 1} (eCheq): ${faltan.map((f) => f.mensaje).join(" ")}` };
    }
  }

  // Saldo a cubrir por viaje, en el orden de los LP y sus líneas.
  const lineas = await db
    .select({ lp_id: liquidoProductoLineas.liquido_producto_id, viaje_id: liquidoProductoLineas.viaje_id, total: liquidoProductoLineas.total, saldo: viajes.saldo_pendiente })
    .from(liquidoProductoLineas)
    .innerJoin(viajes, eq(liquidoProductoLineas.viaje_id, viajes.id))
    .where(inArray(liquidoProductoLineas.liquido_producto_id, lps.map((l) => l.id)))
    .orderBy(asc(liquidoProductoLineas.id));
  const orden = new Map(lps.map((l, i) => [l.id, i]));
  lineas.sort((a, b) => orden.get(a.lp_id)! - orden.get(b.lp_id)!);
  const saldos = lineas.map((l) => ({
    viaje_id: l.viaje_id!,
    saldo: Math.max(0, Number(l.saldo ?? l.total)),
  }));

  const imputacionesPorPago = datos.pagos.map((p) => {
    let resto = p.importe;
    const imputaciones: { viaje_id: number; importe: number }[] = [];
    for (const s of saldos) {
      if (resto <= 0.004) break;
      const toma = Math.min(resto, s.saldo);
      if (toma <= 0.004) continue;
      imputaciones.push({ viaje_id: s.viaje_id, importe: toma });
      s.saldo -= toma;
      resto -= toma;
    }
    return imputaciones;
  });

  const clienteId = lps[0].cliente_id;
  await db.transaction(async (tx) => {
    for (const [i, p] of datos.pagos.entries()) {
      const [cobro] = await tx
        .insert(cobros)
        .values({
          fecha: fechaAr(datos.fecha),
          cliente_id: clienteId,
          medio_pago_id: p.medio_pago_id,
          importe: p.importe.toFixed(2),
          referencia: datos.referencia,
          banco: p.banco,
          cheque_nro: p.cheque_nro,
          cheque_vto: p.cheque_vto ? fechaAr(p.cheque_vto) : null,
          observaciones: datos.observaciones ?? `Pago de LP ${lps.map((l) => l.numero).join(", ")}`,
        })
        .returning({ id: cobros.id });
      if (imputacionesPorPago[i].length > 0) {
        await tx.insert(cobroImputaciones).values(
          imputacionesPorPago[i].map((imp) => ({ cobro_id: cobro.id, viaje_id: imp.viaje_id, importe_imputado: imp.importe.toFixed(2) }))
        );
      }
      await tx.insert(liquidoProductoCobros).values(lps.map((l) => ({ liquido_producto_id: l.id, cobro_id: cobro.id })));
    }
    await tx
      .update(liquidosProducto)
      .set({ pagado: true, fecha_pago: fechaAr(datos.fecha), actualizado_en: new Date() })
      .where(inArray(liquidosProducto.id, lps.map((l) => l.id)));
  });

  for (const viajeId of new Set(saldos.map((s) => s.viaje_id))) {
    await recalcularCobro(viajeId);
    await avanzarEstadoAutomatico(viajeId);
  }
  return { cobros: datos.pagos.length };
}

/**
 * Vuelve un LP a "pendiente": borra los cobros con los que se pagó. Si
 * ese pago cubría otros LP (marcado grupal), esos también vuelven a
 * pendiente; se devuelven sus números para avisarlo.
 */
export async function desmarcarLpPagado(lpId: number): Promise<{ error?: string; desmarcados?: string[] }> {
  const cobrosLp = (
    await db
      .select({ cobro_id: liquidoProductoCobros.cobro_id })
      .from(liquidoProductoCobros)
      .where(eq(liquidoProductoCobros.liquido_producto_id, lpId))
  ).map((c) => c.cobro_id);

  const afectados = new Set([lpId]);
  const viajesAfectados = new Set<number>();
  if (cobrosLp.length > 0) {
    for (const f of await db
      .select({ lp: liquidoProductoCobros.liquido_producto_id })
      .from(liquidoProductoCobros)
      .where(inArray(liquidoProductoCobros.cobro_id, cobrosLp)))
      afectados.add(f.lp);
    for (const f of await db
      .select({ viaje_id: cobroImputaciones.viaje_id })
      .from(cobroImputaciones)
      .where(inArray(cobroImputaciones.cobro_id, cobrosLp)))
      viajesAfectados.add(f.viaje_id);
  }

  const desmarcados = await db.transaction(async (tx) => {
    if (cobrosLp.length > 0) await tx.delete(cobros).where(inArray(cobros.id, cobrosLp));
    return tx
      .update(liquidosProducto)
      .set({ pagado: false, fecha_pago: null, actualizado_en: new Date() })
      .where(inArray(liquidosProducto.id, [...afectados]))
      .returning({ numero: liquidosProducto.numero });
  });

  for (const id of viajesAfectados) await recalcularCobro(id);
  return { desmarcados: desmarcados.map((d) => d.numero) };
}
