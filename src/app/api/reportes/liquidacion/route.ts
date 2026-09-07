import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  choferes,
  clientes,
  liquidacionesChofer,
  liquidacionViajes,
  mediosPago,
  movimientosChofer,
  viajes,
} from "@/db/schema";
import { generarXlsx, respuestaXlsx } from "@/lib/reportes/xlsx";
import { signoTipoMovimiento } from "@/lib/cuenta-corriente/signo";

const formatoFecha = (v: Date | string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

const ETIQUETAS_MODALIDAD_TARIFA: Record<string, string> = {
  por_tonelada: "Por tonelada",
  por_km: "Por km",
  por_tonelada_km: "Por tonelada-km",
  monto_fijo: "Monto fijo",
};

const ETIQUETAS_MODALIDAD_PAGO: Record<string, string> = {
  porcentaje_flete: "Porcentaje del flete",
  monto_fijo_viaje: "Monto fijo por viaje",
  por_tonelada: "Por tonelada",
  sueldo: "Sueldo",
  sin_definir: "Sin definir",
};

const ETIQUETAS_MOVIMIENTO: Record<string, string> = {
  adelanto: "Adelanto",
  gasoil: "Gasoil a cuenta",
  gasto_rendido: "Gasto rendido",
  liquidacion: "Liquidación",
  devolucion: "Devolución",
  ajuste: "Ajuste",
};

/**
 * Detalle exportable de UNA liquidación ya generada, pensado para
 * entregarle al chofer: un renglón por viaje (fecha, CTG, kg destino,
 * tarifa, su % y lo que le corresponde en ese viaje) más un resumen con
 * las deducciones y el total neto -- lo mismo que ya se calculó al armar
 * la liquidación, no un recálculo en vivo.
 */
export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get("liquidacion_id");
  const id = idParam ? Number(idParam) : NaN;
  if (Number.isNaN(id)) {
    return new Response("Falta liquidacion_id.", { status: 400 });
  }

  const [liq] = await db
    .select({
      id: liquidacionesChofer.id,
      chofer_nombre: choferes.nombre_completo,
      modalidad_pago: choferes.modalidad_pago,
      valor_pago: choferes.valor_pago,
      fecha: liquidacionesChofer.fecha,
      periodo_desde: liquidacionesChofer.periodo_desde,
      periodo_hasta: liquidacionesChofer.periodo_hasta,
      total_viajes: liquidacionesChofer.total_viajes,
      total_adelantos: liquidacionesChofer.total_adelantos,
      total_neto: liquidacionesChofer.total_neto,
      pagado: liquidacionesChofer.pagado,
      medio_pago_nombre: mediosPago.nombre,
      observaciones: liquidacionesChofer.observaciones,
    })
    .from(liquidacionesChofer)
    .leftJoin(choferes, eq(liquidacionesChofer.chofer_id, choferes.id))
    .leftJoin(mediosPago, eq(liquidacionesChofer.medio_pago_id, mediosPago.id))
    .where(eq(liquidacionesChofer.id, id));
  if (!liq) {
    return new Response("Liquidación no encontrada.", { status: 404 });
  }

  const [filasViajes, filasMovimientos] = await Promise.all([
    db
      .select({
        numero: viajes.numero,
        fecha_carga: viajes.fecha_carga,
        ctg: viajes.ctg,
        cliente: clientes.razon_social,
        neto_destino: viajes.neto_destino,
        modalidad_tarifa: viajes.modalidad_tarifa,
        valor_tarifa: viajes.valor_tarifa,
        importe: liquidacionViajes.importe,
      })
      .from(liquidacionViajes)
      .innerJoin(viajes, eq(liquidacionViajes.viaje_id, viajes.id))
      .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
      .where(eq(liquidacionViajes.liquidacion_id, id))
      .orderBy(viajes.fecha_carga),
    db
      .select({ tipo: movimientosChofer.tipo, importe: movimientosChofer.importe, descripcion: movimientosChofer.descripcion })
      .from(movimientosChofer)
      .where(eq(movimientosChofer.liquidacion_id, id)),
  ]);

  const totalViajes = filasViajes.reduce((s, v) => s + Number(v.importe ?? 0), 0);
  const etiquetaModalidadPago = liq.modalidad_pago ? ETIQUETAS_MODALIDAD_PAGO[liq.modalidad_pago] : "—";
  const valorPagoTexto =
    liq.modalidad_pago === "porcentaje_flete" ? `${liq.valor_pago}%` : liq.valor_pago;

  const buffer = generarXlsx([
    {
      nombre: "Detalle de viajes",
      filas: [
        ...filasViajes.map((v) => ({
          "N° viaje": v.numero,
          "Fecha de carga": formatoFecha(v.fecha_carga),
          CTG: v.ctg ?? "",
          Cliente: v.cliente ?? "",
          "Kg destino": v.neto_destino,
          "Modalidad tarifa": v.modalidad_tarifa ? ETIQUETAS_MODALIDAD_TARIFA[v.modalidad_tarifa] : "",
          Tarifa: v.valor_tarifa,
          [`${etiquetaModalidadPago} (${valorPagoTexto})`]: v.importe,
        })),
        {
          "N° viaje": "",
          "Fecha de carga": "",
          CTG: "",
          Cliente: "",
          "Kg destino": "",
          "Modalidad tarifa": "",
          Tarifa: "TOTAL VIAJES",
          [`${etiquetaModalidadPago} (${valorPagoTexto})`]: totalViajes,
        },
      ],
    },
    {
      nombre: "Resumen",
      filas: [
        { Concepto: "Chofer", Valor: liq.chofer_nombre },
        { Concepto: "Período desde", Valor: formatoFecha(liq.periodo_desde) },
        { Concepto: "Período hasta", Valor: formatoFecha(liq.periodo_hasta) },
        { Concepto: "Viajes incluidos", Valor: liq.total_viajes },
        { Concepto: "Total trabajado (viajes)", Valor: totalViajes },
        ...filasMovimientos.map((m) => ({
          Concepto: `${ETIQUETAS_MOVIMIENTO[m.tipo] ?? m.tipo}${m.descripcion ? ` — ${m.descripcion}` : ""}`,
          Valor: signoTipoMovimiento(m.tipo) * Number(m.importe),
        })),
        { Concepto: "TOTAL NETO A PAGAR", Valor: Number(liq.total_neto ?? 0) },
        { Concepto: "Estado", Valor: liq.pagado ? "Pagada" : "Pendiente de pago" },
        { Concepto: "Medio de pago", Valor: liq.medio_pago_nombre ?? "" },
      ],
    },
  ]);

  return respuestaXlsx(buffer, `liquidacion-${liq.chofer_nombre}-${formatoFecha(liq.fecha)}.xlsx`);
}
