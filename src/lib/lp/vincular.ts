import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, cobroImputaciones, liquidoProductoLineas, liquidosProducto, viajes } from "@/db/schema";
import { eliminarAdjunto, subirAdjunto } from "@/lib/supabase/storage";
import { recalcularFlete } from "@/app/(app)/viajes/_lib/flete";
import { recalcularLiquidacionChofer } from "@/app/(app)/viajes/_lib/liquidacion";
import { recalcularCobro } from "@/app/(app)/viajes/_lib/cobro";
import { avanzarEstadoAutomatico } from "@/app/(app)/viajes/_lib/avance-estado";
import { nroFacturaLp } from "./comparar";
import { procesarLp } from "./importar";
import { netoLinea } from "./parser";

const sinCeros = (v: string) => v.replace(/^0+/, "") || v;
const dos = (n: number) => n.toFixed(2);

export type ResultadoCargaLp =
  | {
      ok: true;
      /** false si ese LP ya estaba cargado (se reintentó vincular lo pendiente). */
      nuevo: boolean;
      lp_id: number;
      numero: string;
      cliente: string;
      fecha: string;
      total: number;
      fuente: "texto" | "ia";
      vinculadas: number;
      sin_vincular: number;
      avisos: string[];
    }
  | { ok: false; error: string; falta_numero?: boolean };

/**
 * Lee un líquido producto, lo guarda en Cobranzas y vincula cada Carta de
 * Porte con su viaje (sin pantalla de revisión: las diferencias de kilos o
 * tarifa quedan como aviso en el LP). Si el LP ya estaba cargado no se
 * duplica: solo se reintenta vincular las CPE que habían quedado sueltas.
 */
export async function cargarLiquidoProducto(
  archivo: { nombre: string; tipo: string; buffer: Buffer },
  numeroManual?: string
): Promise<ResultadoCargaLp> {
  const leido = await procesarLp(archivo.buffer);
  if (!leido.ok) return { ok: false, error: leido.error };
  const { lp, fuente } = leido;

  const numero = (numeroManual?.trim() || lp.numero || "").trim();
  if (!numero) {
    return { ok: false, error: "No se pudo leer el número del líquido producto. Escribilo y volvé a intentar.", falta_numero: true };
  }
  if (!lp.fecha) return { ok: false, error: "No se pudo leer la fecha del líquido producto." };

  // El emisor es quien paga el flete. Si el comprobante no trae un CUIT
  // legible, se usa el cliente que ya tienen sus viajes (si es uno solo).
  let emisor = leido.emisor;
  if (!emisor && !lp.emisor_cuit) {
    const clientesViajes = new Set(leido.lineas.flatMap((l) => l.viajes.map((v) => v.cliente_id)).filter((c) => c != null));
    if (clientesViajes.size === 1) {
      const [c] = await db
        .select({ id: clientes.id, razon_social: clientes.razon_social, comision_pct: clientes.comision_intermediario_pct_default })
        .from(clientes)
        .where(eq(clientes.id, [...clientesViajes][0]!));
      emisor = c ?? null;
    }
  }
  if (!emisor) {
    return {
      ok: false,
      error: lp.emisor_cuit
        ? `El emisor (CUIT ${lp.emisor_cuit}) no está cargado como cliente. Agregalo en Clientes y volvé a intentar.`
        : "No se pudo leer el CUIT del emisor del líquido producto.",
    };
  }

  const [existente] = await db
    .select({ id: liquidosProducto.id })
    .from(liquidosProducto)
    .where(and(eq(liquidosProducto.cliente_id, emisor.id), eq(liquidosProducto.numero, numero)));
  if (existente) {
    const avisos = await vincularPendientes(existente.id);
    return resumen(existente.id, false, fuente, avisos);
  }

  const sumaNetos = lp.lineas.reduce((s, l) => s + netoLinea(l), 0);
  const neto = lp.neto_gravado ?? sumaNetos;
  const iva = lp.iva ?? neto * 0.21;
  const alicuota = neto > 0 ? iva / neto : 0.21;

  const ruta = `liquido_producto/${randomUUID()}-${archivo.nombre}`;
  await subirAdjunto(ruta, archivo.buffer, archivo.tipo || "application/pdf");

  let lpId: number;
  try {
    lpId = await db.transaction(async (tx) => {
      const [nuevo] = await tx
        .insert(liquidosProducto)
        .values({
          cliente_id: emisor.id,
          numero,
          fecha: new Date(`${lp.fecha}T12:00:00-03:00`),
          cae: lp.cae,
          neto_gravado: dos(neto),
          iva: dos(iva),
          total: dos(lp.total ?? neto + iva),
          fuente,
          nombre_archivo: archivo.nombre,
          storage_path: ruta,
        })
        .returning({ id: liquidosProducto.id });
      await tx.insert(liquidoProductoLineas).values(
        lp.lineas.map((l) => {
          const netoL = netoLinea(l);
          const ivaL = netoL * alicuota;
          return {
            liquido_producto_id: nuevo.id,
            ctg: l.ctg,
            kg: l.kg != null ? dos(l.kg) : null,
            tarifa: l.tarifa != null ? dos(l.tarifa) : null,
            km: l.km,
            flete: dos(l.total),
            comision: dos(l.comision),
            otros_descuentos: dos(l.otros_descuentos),
            neto: dos(netoL),
            iva: dos(ivaL),
            total: dos(netoL + ivaL),
          };
        })
      );
      return nuevo.id;
    });
  } catch (err) {
    await eliminarAdjunto(ruta).catch(() => {});
    throw err;
  }

  // El aviso de "no se pudo leer el número" no aplica si se escribió a mano.
  const avisosLectura = leido.avisos.filter((a) => !a.startsWith("No se pudo leer el número"));
  const avisos = [...avisosLectura, ...(await vincularPendientes(lpId))];
  return resumen(lpId, true, fuente, avisos);
}

async function resumen(lpId: number, nuevo: boolean, fuente: "texto" | "ia", avisos: string[]): Promise<ResultadoCargaLp> {
  const [cab] = await db
    .select({
      numero: liquidosProducto.numero,
      fecha: liquidosProducto.fecha,
      total: liquidosProducto.total,
      cliente: clientes.razon_social,
    })
    .from(liquidosProducto)
    .innerJoin(clientes, eq(liquidosProducto.cliente_id, clientes.id))
    .where(eq(liquidosProducto.id, lpId));
  const lineas = await db
    .select({ viaje_id: liquidoProductoLineas.viaje_id })
    .from(liquidoProductoLineas)
    .where(eq(liquidoProductoLineas.liquido_producto_id, lpId));
  const vinculadas = lineas.filter((l) => l.viaje_id != null).length;
  return {
    ok: true,
    nuevo,
    lp_id: lpId,
    numero: cab.numero,
    cliente: cab.cliente,
    fecha: cab.fecha.toISOString().slice(0, 10),
    total: Number(cab.total),
    fuente,
    vinculadas,
    sin_vincular: lineas.length - vinculadas,
    avisos,
  };
}

/** Intenta vincular las líneas del LP que todavía no tienen viaje. Devuelve los avisos. */
export async function vincularPendientes(lpId: number): Promise<string[]> {
  const pendientes = await db
    .select({ id: liquidoProductoLineas.id })
    .from(liquidoProductoLineas)
    .where(and(eq(liquidoProductoLineas.liquido_producto_id, lpId), isNull(liquidoProductoLineas.viaje_id)))
    .orderBy(liquidoProductoLineas.id);
  const avisos: string[] = [];
  for (const p of pendientes) {
    const aviso = await vincularLinea(p.id);
    if (aviso) avisos.push(aviso);
  }
  return avisos;
}

/**
 * Busca el viaje de la línea por su CTG y, si hay uno solo libre, lo
 * vincula y lo deja facturado con los importes del LP. Devuelve el aviso
 * (por qué no se vinculó, o qué cambió del viaje) o null.
 */
async function vincularLinea(lineaId: number): Promise<string | null> {
  const [fila] = await db
    .select({
      linea: liquidoProductoLineas,
      lp_numero: liquidosProducto.numero,
      lp_fecha: liquidosProducto.fecha,
      cliente_id: liquidosProducto.cliente_id,
    })
    .from(liquidoProductoLineas)
    .innerJoin(liquidosProducto, eq(liquidoProductoLineas.liquido_producto_id, liquidosProducto.id))
    .where(eq(liquidoProductoLineas.id, lineaId));
  if (!fila || fila.linea.viaje_id != null) return null;
  const { linea } = fila;
  const cpe = `CPE ${linea.ctg}`;

  const candidatos = await db
    .select({ id: viajes.id, numero: viajes.numero, factura_nro: viajes.factura_nro })
    .from(viajes)
    .where(and(eq(sql`ltrim(${viajes.ctg}, '0')`, sinCeros(linea.ctg)), ne(viajes.estado, "rechazado")));

  const guardarAviso = async (aviso: string) => {
    await db.update(liquidoProductoLineas).set({ aviso }).where(eq(liquidoProductoLineas.id, lineaId));
    return aviso;
  };

  if (candidatos.length === 0) return guardarAviso(`${cpe}: no está cargada en Viajes.`);
  if (candidatos.length > 1) {
    const nros = candidatos.map((c) => `#${c.numero ?? c.id}`).join(", ");
    return guardarAviso(`${cpe}: hay ${candidatos.length} viajes con esa carta de porte (${nros}); dejá uno solo.`);
  }
  const viaje = candidatos[0];

  const [enOtro] = await db
    .select({ numero: liquidosProducto.numero })
    .from(liquidoProductoLineas)
    .innerJoin(liquidosProducto, eq(liquidoProductoLineas.liquido_producto_id, liquidosProducto.id))
    .where(eq(liquidoProductoLineas.viaje_id, viaje.id));
  if (enOtro) return guardarAviso(`${cpe}: el viaje #${viaje.numero ?? viaje.id} ya está en el líquido producto ${enOtro.numero}.`);

  const nroFactura = nroFacturaLp(fila.lp_numero);
  const aviso =
    viaje.factura_nro && viaje.factura_nro !== nroFactura
      ? `${cpe}: el viaje #${viaje.numero ?? viaje.id} tenía cargada la factura "${viaje.factura_nro}"; quedó reemplazada por el LP.`
      : null;

  try {
    await db.update(liquidoProductoLineas).set({ viaje_id: viaje.id, aviso }).where(eq(liquidoProductoLineas.id, lineaId));
  } catch (err) {
    // Otro LP vinculó el mismo viaje al mismo tiempo (índice único).
    if ((err as { code?: string }).code === "23505") return guardarAviso(`${cpe}: el viaje ya está en otro líquido producto.`);
    throw err;
  }

  const [conCobro] = await db
    .select({ id: cobroImputaciones.id })
    .from(cobroImputaciones)
    .where(eq(cobroImputaciones.viaje_id, viaje.id))
    .limit(1);
  const flete = Number(linea.flete);
  const comision = Number(linea.comision);

  await db
    .update(viajes)
    .set({
      // Quien emite el LP es quien paga el flete; si el viaje ya tiene
      // cobros de otro cliente, se respeta para no dejarlos colgados.
      ...(conCobro ? {} : { cliente_id: fila.cliente_id }),
      ...(comision > 0 && flete > 0
        ? {
            intermediario_id: fila.cliente_id,
            // A 2 decimales: ver la nota en parser.ts (Buenos Viajes
            // redondea las toneladas y el % exacto da 7,999 / 8,001).
            comision_intermediario_pct: ((comision / flete) * 100).toFixed(2),
          }
        : {}),
      factura_nro: nroFactura,
      factura_fecha: fila.lp_fecha,
      factura_importe_neto: linea.neto,
      factura_iva: linea.iva,
      factura_importe_total: linea.total,
      facturado: true,
      actualizado_en: new Date(),
    })
    .where(eq(viajes.id, viaje.id));
  await recalcularFlete(viaje.id);
  await recalcularLiquidacionChofer(viaje.id);
  await recalcularCobro(viaje.id);
  await avanzarEstadoAutomatico(viaje.id);
  return aviso;
}

/**
 * Borra un LP que todavía no está pagado: los viajes vinculados pierden la
 * facturación que les puso el LP (vuelven a "sin facturar" para Cobranzas).
 * El estado del viaje no retrocede, igual que en el resto de la app.
 */
export async function eliminarLiquidoProducto(lpId: number): Promise<{ error?: string }> {
  const [lp] = await db.select().from(liquidosProducto).where(eq(liquidosProducto.id, lpId));
  if (!lp) return {};
  if (lp.pagado) return { error: "El líquido producto está marcado como pagado: desmarcalo antes de borrarlo." };

  const vinculados = (
    await db
      .select({ viaje_id: liquidoProductoLineas.viaje_id })
      .from(liquidoProductoLineas)
      .where(eq(liquidoProductoLineas.liquido_producto_id, lpId))
  )
    .map((l) => l.viaje_id)
    .filter((v): v is number => v != null);

  await db.delete(liquidosProducto).where(eq(liquidosProducto.id, lpId));
  if (vinculados.length > 0) {
    await db
      .update(viajes)
      .set({
        factura_nro: null,
        factura_fecha: null,
        factura_importe_neto: null,
        factura_iva: null,
        factura_importe_total: null,
        actualizado_en: new Date(),
      })
      .where(and(inArray(viajes.id, vinculados), eq(viajes.factura_nro, nroFacturaLp(lp.numero))));
    for (const id of vinculados) await recalcularCobro(id);
  }
  if (lp.storage_path) await eliminarAdjunto(lp.storage_path).catch(() => {});
  return {};
}
