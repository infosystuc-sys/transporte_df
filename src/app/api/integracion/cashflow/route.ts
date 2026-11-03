import { timingSafeEqual } from "node:crypto";
import { and, asc, eq, inArray, isNull, notExists } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { clientes, cobroImputaciones, cobros, mediosPago, viajes } from "@/db/schema";
import { clasificarMedioPago } from "@/lib/cobros/medio-pago";
import { empresaReceptora } from "@/lib/integracion/empresa";

// Siempre datos al momento: el Cash Flow consulta cuando lo necesita.
export const dynamic = "force-dynamic";

const ALICUOTA_IVA = 0.21;

/**
 * Viaje realizado que el cliente todavía no liquidó ni pagó. No se usa el
 * booleano viajes.facturado: al liquidar al chofer el viaje pasa a
 * "liquidado" y avanzarEstadoAutomatico lo marca facturado aunque el
 * cliente nunca haya mandado su LP o factura. Lo que sí indica que el
 * cliente liquidó es el número de comprobante (factura_nro), y que pagó,
 * un cobro imputado.
 */
const viajeSinFacturar = and(
  inArray(viajes.estado, ["descargado", "facturado", "cobrado", "liquidado"]),
  isNull(viajes.factura_nro),
  notExists(
    db.select({ uno: cobroImputaciones.id }).from(cobroImputaciones).where(eq(cobroImputaciones.viaje_id, viajes.id))
  )
);

/**
 * Token compartido con la app de Cash Flow, solo del lado del servidor
 * (variable CASHFLOW_API_TOKEN en Vercel). Sin variable configurada no
 * responde nunca: mejor un 401 que un endpoint abierto por olvido.
 */
function tokenValido(request: NextRequest): boolean {
  const esperado = process.env.CASHFLOW_API_TOKEN;
  if (!esperado) return false;
  const recibido = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

const numero = (v: string | null) => (v == null ? null : Number(v));
const redondear = (n: number) => Math.round(n * 100) / 100;
const soloFecha = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Solo lectura, para la app de Cash Flow (apps separadas):
 * - viajes_sin_facturar: realizados, sin comprobante del cliente ni cobros
 *   (ver viajeSinFacturar).
 * - cobros: todos los cobros vigentes. Uno borrado deja de aparecer y uno
 *   modificado cambia su actualizado_en: así el Cash Flow detecta ambos.
 */
export async function GET(request: NextRequest) {
  if (!tokenValido(request)) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" } }
    );
  }

  const [filasViajes, filasCobros] = await Promise.all([
    db
      .select({
        id: viajes.id,
        numero: viajes.numero,
        estado: viajes.estado,
        fecha_descarga: viajes.fecha_descarga,
        cliente_id: viajes.cliente_id,
        cliente_razon_social: clientes.razon_social,
        importe_flete: viajes.importe_flete,
        importe_adicionales: viajes.importe_adicionales,
        importe_comision: viajes.importe_comision,
      })
      .from(viajes)
      .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
      .where(viajeSinFacturar)
      .orderBy(asc(viajes.fecha_descarga), asc(viajes.id)),
    db
      .select({
        id: cobros.id,
        fecha: cobros.fecha,
        cliente_id: cobros.cliente_id,
        cliente_razon_social: clientes.razon_social,
        medio_pago_nombre: mediosPago.nombre,
        importe: cobros.importe,
        cheque_nro: cobros.cheque_nro,
        banco: cobros.banco,
        cheque_vto: cobros.cheque_vto,
        referencia: cobros.referencia,
        actualizado_en: cobros.actualizado_en,
      })
      .from(cobros)
      .leftJoin(clientes, eq(cobros.cliente_id, clientes.id))
      .leftJoin(mediosPago, eq(cobros.medio_pago_id, mediosPago.id))
      .orderBy(asc(cobros.id)),
  ]);

  const viajes_sin_facturar = filasViajes.map((v) => {
    const flete = numero(v.importe_flete);
    const adicionales = numero(v.importe_adicionales) ?? 0;
    const comision = numero(v.importe_comision) ?? 0;
    // Sin flete calculado (falta tarifa o kilos) no hay neto que informar.
    const neto = flete == null ? null : redondear(flete + adicionales - comision);
    const iva = neto == null ? null : redondear(neto * ALICUOTA_IVA);
    return {
      id: v.id,
      numero: v.numero,
      estado: v.estado,
      fecha_descarga: soloFecha(v.fecha_descarga),
      cliente: v.cliente_id == null ? null : { id: v.cliente_id, razon_social: v.cliente_razon_social },
      importe_flete: flete,
      importe_adicionales: adicionales,
      importe_comision: comision,
      neto,
      iva,
      total: neto == null || iva == null ? null : redondear(neto + iva),
      empresa: empresaReceptora({ cliente_id: v.cliente_id }),
    };
  });

  const cobrosJson = filasCobros.map((c) => ({
    id: c.id,
    fecha: soloFecha(c.fecha),
    cliente: { id: c.cliente_id, razon_social: c.cliente_razon_social },
    medio_pago: clasificarMedioPago(c.medio_pago_nombre),
    importe: Number(c.importe),
    cheque_nro: c.cheque_nro || null,
    banco: c.banco || null,
    cheque_vto: soloFecha(c.cheque_vto),
    referencia: c.referencia || null,
    empresa: empresaReceptora({ cliente_id: c.cliente_id }),
    actualizado_en: c.actualizado_en.toISOString(),
  }));

  return NextResponse.json(
    { generado_en: new Date().toISOString(), viajes_sin_facturar, cobros: cobrosJson },
    { headers: { "Cache-Control": "no-store" } }
  );
}
