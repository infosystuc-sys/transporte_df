import { and, desc, eq, isNull, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { camiones, cargasGasoil, estacionesServicio, viajes } from "@/db/schema";
import type { cargaGasoilSchema } from "@/lib/schemas/gasoil";
import { registrarMovimientoAutomatico } from "@/lib/cuenta-corriente/movimientos";

export type CargaGasoilValidada = ReturnType<typeof cargaGasoilSchema.parse>;

const DIA_MS = 24 * 3600 * 1000;

/**
 * A qué viaje va una carga de gasoil que se sube sin elegir viaje. Regla
 * acordada con David (lo importante es que quede imputado a algún viaje):
 * 1. Si el chofer (o el camión, si la carga no tiene chofer) tiene un
 *    viaje en curso, todavía sin descarga, va a ese: muchas veces cargan
 *    gasoil antes o después de tener la CPE del viaje que están haciendo.
 *    Ese viaje tiene que haber arrancado entre 10 días antes y 2 días
 *    después de la carga, para no pegar un ticket viejo a un viaje actual.
 * 2. Si no, va al último viaje que arrancó hasta el día de la carga (el
 *    que acaba de descargar).
 * Las fechas llegan sin hora (medianoche UTC del día), igual que la de la carga.
 */
export async function viajeParaGasoil(datos: { fecha: Date; chofer_id?: number | null; camion_id: number }) {
  const fechaViaje = sql`coalesce(${viajes.fecha_carga}, ${viajes.fecha_partida}, ${viajes.cpe_fecha_emision}, ${viajes.creado_en})`;
  const filtroQuien = datos.chofer_id ? eq(viajes.chofer_id, datos.chofer_id) : eq(viajes.camion_id, datos.camion_id);
  const dia = datos.fecha.getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  const [enCurso] = await db
    .select({ id: viajes.id })
    .from(viajes)
    .where(
      and(
        filtroQuien,
        notInArray(viajes.estado, ["planificado", "rechazado"]),
        isNull(viajes.fecha_descarga),
        sql`${fechaViaje} >= ${iso(dia - 10 * DIA_MS)}::timestamptz`,
        sql`${fechaViaje} < ${iso(dia + 3 * DIA_MS)}::timestamptz`
      )
    )
    .orderBy(sql`abs(extract(epoch from ${fechaViaje} - ${iso(dia)}::timestamptz))`, desc(viajes.id))
    .limit(1);
  if (enCurso) return enCurso.id;

  const [anterior] = await db
    .select({ id: viajes.id })
    .from(viajes)
    .where(and(filtroQuien, ne(viajes.estado, "planificado"), sql`${fechaViaje} < ${iso(dia + DIA_MS)}::timestamptz`))
    .orderBy(desc(fechaViaje), desc(viajes.id))
    .limit(1);
  return anterior?.id ?? null;
}

/** Inserta la carga y aplica los efectos secundarios (odómetro, cuenta
 * corriente del chofer). Devuelve el id — lo usan tanto el alta manual
 * como el alta con comprobante adjunto para no duplicar esta lógica. */
export async function insertarCargaGasoil(entrada: CargaGasoilValidada) {
  // Si no se eligió a qué viaje corresponde, la app lo elige (ver viajeParaGasoil).
  const datos = entrada.viaje_id ? entrada : { ...entrada, viaje_id: await viajeParaGasoil(entrada) };
  const [carga] = await db.insert(cargasGasoil).values(datos).returning({ id: cargasGasoil.id });

  const [camion] = await db.select().from(camiones).where(eq(camiones.id, datos.camion_id));
  if (
    camion &&
    datos.odometro != null &&
    (camion.odometro_actual == null || datos.odometro > camion.odometro_actual)
  ) {
    await db.update(camiones).set({ odometro_actual: datos.odometro }).where(eq(camiones.id, datos.camion_id));
  }

  // El schema exige importe cuando modalidad = pagado_por_chofer, así que
  // acá siempre está presente — el chequeo es solo para conformar a TS.
  if (datos.modalidad === "pagado_por_chofer" && datos.chofer_id && datos.importe) {
    const [estacion] = datos.estacion_id
      ? await db.select().from(estacionesServicio).where(eq(estacionesServicio.id, datos.estacion_id))
      : [];
    await registrarMovimientoAutomatico({
      chofer_id: datos.chofer_id,
      tipo: "gasto_rendido",
      importe: datos.importe,
      viaje_id: datos.viaje_id,
      descripcion: `Gasoil${estacion ? ` en ${estacion.nombre}` : ""} (${datos.litros} L)`,
    });
  }

  return carga.id;
}

