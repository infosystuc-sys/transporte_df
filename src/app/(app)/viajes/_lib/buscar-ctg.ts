import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, viajes } from "@/db/schema";

/**
 * Busca viajes ya cargados por CTG, para la importación de descarga
 * (spec: matchear el ticket de balanza contra el viaje que ya tiene la
 * CPE de origen). No hay constraint de unicidad en viajes.ctg hoy -- se
 * devuelven todos los que matchean para que el que llama decida qué
 * hacer si hay más de uno, en vez de asumir que siempre hay como mucho
 * un resultado.
 *
 * Compara sin ceros a la izquierda: la CPE suele traer el CTG sin
 * padding ("10134772641") pero una nota de recepción del mismo CTG (ej.
 * Cargill) a veces lo imprime con un cero adelante ("010134772641") --
 * mismo número, texto distinto. Sin esto, importar la descarga por CTG
 * nunca encuentra el viaje que la propia CPE ya cargó.
 */
export async function buscarViajesPorCtg(ctg: string) {
  const ctgSinCerosIniciales = ctg.replace(/^0+/, "") || ctg;
  return db
    .select({
      id: viajes.id,
      numero: viajes.numero,
      estado: viajes.estado,
      ctg: viajes.ctg,
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
    .where(sql`ltrim(${viajes.ctg}, '0') = ${ctgSinCerosIniciales}`);
}

export type ViajeEncontradoPorCtg = Awaited<ReturnType<typeof buscarViajesPorCtg>>[number];
