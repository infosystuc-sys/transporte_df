import { eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, viajes } from "@/db/schema";

/**
 * Compara sin ceros a la izquierda: la CPE suele traer el número sin
 * padding ("10134772641") pero una nota de recepción del mismo número (ej.
 * Cargill) a veces lo imprime con un cero adelante ("010134772641") --
 * mismo número, texto distinto. Sin esto, importar la descarga nunca
 * encuentra el viaje que la propia CPE ya cargó.
 */
function sinCerosIniciales(valor: string) {
  return valor.replace(/^0+/, "") || valor;
}

async function buscarViajesPorCondicion(condicion: SQL) {
  return db
    .select({
      id: viajes.id,
      numero: viajes.numero,
      estado: viajes.estado,
      ctg: viajes.ctg,
      cpe_nro: viajes.cpe_nro,
      cliente_nombre: clientes.razon_social,
      chofer_nombre: choferes.nombre_completo,
      dominio_tractor: camiones.dominio_tractor,
      fecha_arribo: viajes.fecha_arribo,
      fecha_descarga: viajes.fecha_descarga,
      n_turno_descarga: viajes.n_turno_descarga,
      bruto_destino: viajes.bruto_destino,
      tara_destino: viajes.tara_destino,
      neto_destino: viajes.neto_destino,
      humedad_pct: viajes.humedad_pct,
    })
    .from(viajes)
    .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
    .leftJoin(choferes, eq(viajes.chofer_id, choferes.id))
    .leftJoin(camiones, eq(viajes.camion_id, camiones.id))
    .where(condicion);
}

/**
 * Busca viajes ya cargados por CTG, para el chequeo de CTG duplicado al
 * importar una CPE nueva. No hay constraint de unicidad en viajes.ctg hoy
 * -- se devuelven todos los que matchean para que el que llama decida qué
 * hacer si hay más de uno, en vez de asumir que siempre hay como mucho un
 * resultado.
 */
export async function buscarViajesPorCtg(ctg: string) {
  return buscarViajesPorCondicion(sql`ltrim(${viajes.ctg}, '0') = ${sinCerosIniciales(ctg)}`);
}

/**
 * Busca viajes ya cargados por CTG o por número de Carta de Porte, para la
 * importación de descarga (spec: matchear el ticket de balanza contra el
 * viaje que ya tiene la CPE de origen). Algunos comprobantes de descarga
 * (ej. balanzas de puertos/acopios) no traen el CTG sino solo el número de
 * Carta de Porte propio de ese establecimiento -- se acepta cualquiera de
 * los dos que haya podido leer la IA.
 */
export async function buscarViajesPorCtgOCartaPorte(ctg: string | null, cpeNro: string | null) {
  const condiciones: SQL[] = [];
  if (ctg?.trim()) condiciones.push(sql`ltrim(${viajes.ctg}, '0') = ${sinCerosIniciales(ctg.trim())}`);
  if (cpeNro?.trim())
    condiciones.push(sql`ltrim(${viajes.cpe_nro}, '0') = ${sinCerosIniciales(cpeNro.trim())}`);
  if (condiciones.length === 0) return [];
  return buscarViajesPorCondicion(or(...condiciones)!);
}

export type ViajeEncontradoPorCtg = Awaited<ReturnType<typeof buscarViajesPorCtg>>[number];
