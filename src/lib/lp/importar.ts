import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, cobroImputaciones, viajes } from "@/db/schema";
import { extraerTextoCpe } from "@/lib/cpe/extraer";
import { cuitLimpioIgual } from "@/lib/cpe/matching";
import { extraerLpConClaude } from "./claude";
import { netoLinea, parseTextoLp, type LineaLp, type LpExtraido } from "./parser";

export type ViajeParaLp = {
  id: number;
  numero: number | null;
  ctg: string | null;
  cliente_id: number | null;
  cliente_nombre: string | null;
  neto_destino: string | null;
  valor_tarifa: string | null;
  importe_flete: string | null;
  importe_comision: string | null;
  comision_intermediario_pct: string | null;
  total_a_cobrar: string | null;
  factura_nro: string | null;
  tiene_cobros: boolean;
};

export type LineaRevisionLp = {
  linea: LineaLp;
  neto: number;
  /** % de comisión que surge del LP (comisión / flete). */
  comision_pct: number | null;
  /** Viajes cargados con ese CTG (normalmente uno; vacío si no está cargado). */
  viajes: ViajeParaLp[];
};

export type ResultadoLp =
  | {
      ok: true;
      lp: LpExtraido;
      fuente: "texto" | "ia";
      emisor: { id: number; razon_social: string; comision_pct: string | null } | null;
      lineas: LineaRevisionLp[];
      /** Inconsistencias del propio comprobante (no contra los viajes). */
      avisos: string[];
    }
  | { ok: false; error: string };

const sinCeros = (v: string) => v.replace(/^0+/, "") || v;

/**
 * Lee el LP (texto del PDF; si no alcanza, IA) y busca cada CTG entre los
 * viajes cargados. No guarda nada: el resultado va a la pantalla de
 * revisión, que compara cada línea contra su viaje antes de confirmar.
 */
export async function procesarLp(buffer: Buffer): Promise<ResultadoLp> {
  let lp = parseTextoLp(await extraerTextoCpe(buffer));
  let fuente: "texto" | "ia" = "texto";

  if (lp.lineas.length === 0) {
    try {
      const porIa = await extraerLpConClaude(buffer);
      if (!porIa) {
        return { ok: false, error: "No se pudo leer el líquido producto y no hay conexión con la IA configurada." };
      }
      lp = porIa;
      fuente = "ia";
    } catch (err) {
      console.error("procesarLp: falló la lectura por IA:", err);
      return { ok: false, error: "No se pudo conectar con la IA para leer el líquido producto. Probá de nuevo en un rato." };
    }
  }
  if (lp.lineas.length === 0) {
    return { ok: false, error: "No se encontró ningún viaje (Carta de Porte / CTG) en el archivo. ¿Es un líquido producto?" };
  }

  const avisos: string[] = [];
  const sumaNetos = lp.lineas.reduce((s, l) => s + netoLinea(l), 0);
  if (lp.neto_gravado != null && Math.abs(sumaNetos - lp.neto_gravado) > 1) {
    avisos.push(
      `La suma de las líneas ($${sumaNetos.toFixed(2)}) no coincide con el neto gravado del comprobante ($${lp.neto_gravado.toFixed(2)}). Revisá que se hayan leído todos los viajes.`
    );
  }
  if (!lp.numero) avisos.push("No se pudo leer el número del comprobante: completalo antes de confirmar.");

  const [emisor] = lp.emisor_cuit
    ? await db
        .select({
          id: clientes.id,
          razon_social: clientes.razon_social,
          comision_pct: clientes.comision_intermediario_pct_default,
        })
        .from(clientes)
        .where(cuitLimpioIgual(clientes.cuit, lp.emisor_cuit))
    : [];

  const ctgs = lp.lineas.map((l) => sinCeros(l.ctg));
  const filas = await db
    .select({
      id: viajes.id,
      numero: viajes.numero,
      ctg: viajes.ctg,
      cliente_id: viajes.cliente_id,
      cliente_nombre: clientes.razon_social,
      neto_destino: viajes.neto_destino,
      valor_tarifa: viajes.valor_tarifa,
      importe_flete: viajes.importe_flete,
      importe_comision: viajes.importe_comision,
      comision_intermediario_pct: viajes.comision_intermediario_pct,
      total_a_cobrar: viajes.total_a_cobrar,
      factura_nro: viajes.factura_nro,
    })
    .from(viajes)
    .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
    .where(inArray(sql`ltrim(${viajes.ctg}, '0')`, ctgs));

  const conCobros = new Set(
    filas.length === 0
      ? []
      : (
          await db
            .selectDistinct({ viaje_id: cobroImputaciones.viaje_id })
            .from(cobroImputaciones)
            .where(inArray(cobroImputaciones.viaje_id, filas.map((f) => f.id)))
        ).map((f) => f.viaje_id)
  );

  const lineas = lp.lineas.map((linea) => ({
    linea,
    neto: netoLinea(linea),
    comision_pct: linea.total > 0 && linea.comision > 0 ? (linea.comision / linea.total) * 100 : null,
    viajes: filas
      .filter((f) => f.ctg != null && sinCeros(f.ctg) === sinCeros(linea.ctg))
      .map((f) => ({ ...f, tiene_cobros: conCobros.has(f.id) })),
  }));

  return { ok: true, lp, fuente, emisor: emisor ?? null, lineas, avisos };
}
