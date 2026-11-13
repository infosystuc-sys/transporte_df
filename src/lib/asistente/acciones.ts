import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adjuntos, camiones, cargasGasoil, choferes, cobroImputaciones, estacionesServicio, viajes } from "@/db/schema";
import { insertarCargaGasoil, viajeParaGasoil } from "@/lib/gasoil/insertar";
import { cargaGasoilSchema } from "@/lib/schemas/gasoil";
import { subirAdjunto } from "@/lib/supabase/storage";
import { avanzarEstadoAutomatico } from "@/app/(app)/viajes/_lib/avance-estado";
import { borrarViaje } from "@/app/(app)/viajes/_lib/eliminar";
import { recalcularFlete } from "@/app/(app)/viajes/_lib/flete";
import { recalcularLiquidacionChofer } from "@/app/(app)/viajes/_lib/liquidacion";
import { recalcularMerma } from "@/app/(app)/viajes/_lib/merma";

/**
 * Lo que Félix puede hacer además de consultar. Félix nunca guarda nada:
 * arma una propuesta (prepararAccion) que el usuario ve en el chat con un
 * botón Confirmar, y recién al confirmar se guarda (ejecutarAccion). Las dos
 * validan todo de nuevo contra la base, así que una propuesta vieja o
 * tocada a mano no puede guardar algo que la app no deje cargar a mano.
 */

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "La fecha tiene que ser aaaa-mm-dd." });
const id = z.number().int().positive();
const positivo = z.number().positive();

export const accionSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("cargar_gasoil"),
    datos: z.object({
      fecha: fechaIso,
      camion_id: id,
      chofer_id: id.nullable(),
      viaje_id: id.nullable(),
      estacion_id: id.nullable(),
      litros: positivo,
      precio_litro: positivo.nullable(),
      importe: positivo.nullable(),
      modalidad: z.enum(["cuenta_corriente", "pagado_por_chofer", "surtidor_propio"]),
      comprobante_nro: z.string().trim().max(60).nullable(),
      observaciones: z.string().trim().max(500).nullable(),
      con_comprobante: z.boolean(),
    }),
  }),
  z.object({
    tipo: z.literal("cargar_viaje"),
    datos: z.object({
      viaje_id: id,
      fecha_carga: fechaIso.nullable(),
      bruto_origen: positivo.nullable(),
      tara_origen: positivo.nullable(),
      neto_origen: positivo.nullable(),
    }),
  }),
  z.object({
    tipo: z.literal("descargar_viaje"),
    datos: z.object({
      viaje_id: id,
      fecha_descarga: fechaIso.nullable(),
      bruto_destino: positivo.nullable(),
      tara_destino: positivo.nullable(),
      neto_destino: positivo.nullable(),
      con_comprobante: z.boolean(),
    }),
  }),
  z.object({
    tipo: z.literal("cambiar_tarifa"),
    datos: z.object({
      viaje_id: id,
      valor_tarifa: positivo,
      modalidad_tarifa: z.enum(["por_tonelada", "por_km", "por_tonelada_km", "monto_fijo"]).nullable(),
    }),
  }),
  z.object({
    tipo: z.literal("eliminar_viaje"),
    datos: z.object({ viaje_id: id }),
  }),
]);

export type Accion = z.infer<typeof accionSchema>;
export type TipoAccion = Accion["tipo"];

/** Lo que se muestra en la tarjeta de confirmación. */
export type Propuesta = Accion & { titulo: string; detalle: string[]; avisos: string[] };

type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

// ---------- Formato ----------

const pesos = (n: number) =>
  `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number, dec = 2) => n.toLocaleString("es-AR", { maximumFractionDigits: dec });
const kg = (n: number) => `${num(n, 0)} kg`;
const fechaAr = (iso: string) => iso.split("-").reverse().join("/");
const fechaDeBase = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" }).format(d)
    : null;
/** La app guarda las fechas sin hora como medianoche UTC del día (igual que los formularios). */
const fechaGuardar = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const decimal = (n: number) => String(Math.round(n * 100) / 100);

/** Hoy en Argentina, aaaa-mm-dd. */
export function hoyIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

async function buscarViaje(viajeId: number) {
  const [v] = await db
    .select({
      id: viajes.id,
      numero: viajes.numero,
      estado: viajes.estado,
      ctg: viajes.ctg,
      liquidado: viajes.liquidado,
      chofer_id: viajes.chofer_id,
      camion_id: viajes.camion_id,
      chofer: choferes.nombre_completo,
      fecha_carga: viajes.fecha_carga,
      fecha_descarga: viajes.fecha_descarga,
      bruto_origen: viajes.bruto_origen,
      tara_origen: viajes.tara_origen,
      neto_origen: viajes.neto_origen,
      bruto_destino: viajes.bruto_destino,
      tara_destino: viajes.tara_destino,
      neto_destino: viajes.neto_destino,
      valor_tarifa: viajes.valor_tarifa,
      modalidad_tarifa: viajes.modalidad_tarifa,
      importe_flete: viajes.importe_flete,
      factura_nro: viajes.factura_nro,
    })
    .from(viajes)
    .leftJoin(choferes, eq(viajes.chofer_id, choferes.id))
    .where(eq(viajes.id, viajeId));
  return v ?? null;
}

const nombreViaje = (v: { numero: number; ctg: string | null; chofer: string | null }) =>
  `viaje #${v.numero}${v.ctg ? ` (CTG ${v.ctg})` : ""}${v.chofer ? ` de ${v.chofer}` : ""}`;

/** "neto origen: 28.100 kg → 28.300 kg" o "(sin cargar) → 28.300 kg". */
function cambio(etiqueta: string, antes: string | null, despues: string) {
  return antes && antes !== despues ? `${etiqueta}: ${antes} → ${despues}` : `${etiqueta}: ${despues}`;
}
const kgDeBase = (v: string | null) => (v == null ? null : kg(Number(v)));

// ---------- Preparar (lo que Félix propone) ----------

/** Entrada de las herramientas de Félix (antes de completar datos). */
export type EntradaGasoil = {
  fecha: string | null;
  camion_id: number | null;
  chofer_id: number | null;
  viaje_id: number | null;
  estacion_id: number | null;
  litros: number;
  precio_litro: number | null;
  importe: number | null;
  modalidad: "cuenta_corriente" | "pagado_por_chofer" | "surtidor_propio" | null;
  comprobante_nro: string | null;
  observaciones: string | null;
  usar_comprobante_adjunto: boolean;
};

async function prepararGasoil(e: EntradaGasoil, hayAdjunto: boolean): Promise<Resultado<Propuesta>> {
  const fecha = e.fecha ?? hoyIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "La fecha tiene que ser aaaa-mm-dd." };
  if (!(e.litros > 0)) return { ok: false, error: "Faltan los litros: preguntáselos al usuario." };
  const avisos: string[] = [];

  const viajeElegido = e.viaje_id ? await buscarViaje(e.viaje_id) : null;
  if (e.viaje_id && !viajeElegido) return { ok: false, error: `No existe un viaje con id ${e.viaje_id}.` };

  const [chofer] = e.chofer_id
    ? await db
        .select({ id: choferes.id, nombre: choferes.nombre_completo, camion: choferes.camion_habitual_id })
        .from(choferes)
        .where(eq(choferes.id, e.chofer_id))
    : [];
  if (e.chofer_id && !chofer) return { ok: false, error: `No existe un chofer con id ${e.chofer_id}.` };

  // El camión: el que dijo el usuario, si no el del viaje, si no el habitual del chofer.
  const camionId = e.camion_id ?? viajeElegido?.camion_id ?? chofer?.camion ?? null;
  if (!camionId) return { ok: false, error: "No se sabe el camión: preguntale al usuario la patente." };
  const [camion] = await db
    .select({ id: camiones.id, patente: camiones.dominio_tractor })
    .from(camiones)
    .where(eq(camiones.id, camionId));
  if (!camion) return { ok: false, error: `No existe un camión con id ${camionId}.` };
  const choferId = chofer?.id ?? viajeElegido?.chofer_id ?? null;
  const [choferFinal] = choferId
    ? await db.select({ nombre: choferes.nombre_completo }).from(choferes).where(eq(choferes.id, choferId))
    : [];

  const [estacion] = e.estacion_id
    ? await db.select({ nombre: estacionesServicio.nombre }).from(estacionesServicio).where(eq(estacionesServicio.id, e.estacion_id))
    : [];
  if (e.estacion_id && !estacion) return { ok: false, error: `No existe una estación con id ${e.estacion_id}.` };

  // Importe y precio por litro: si viene uno, se calcula el otro.
  const importe = e.importe ?? (e.precio_litro ? e.litros * e.precio_litro : null);
  const precio = e.precio_litro ?? (e.importe ? Math.round((e.importe / e.litros) * 1000) / 1000 : null);
  const modalidad = e.modalidad ?? "cuenta_corriente";
  if (modalidad === "pagado_por_chofer" && importe == null) {
    return { ok: false, error: "Si lo pagó el chofer hace falta el importe, para devolvérselo." };
  }

  // Sin viaje elegido, la misma regla que la pantalla de Gasoil.
  const viajeId =
    viajeElegido?.id ?? (await viajeParaGasoil({ fecha: fechaGuardar(fecha), chofer_id: choferId, camion_id: camionId }));
  const viaje = viajeElegido ?? (viajeId ? await buscarViaje(viajeId) : null);
  if (!viajeElegido) {
    avisos.push(viaje ? `Va al ${nombreViaje(viaje)} (el viaje en curso o el último que hizo).` : "No encontré un viaje para asociarla: queda sin viaje.");
  }

  const comprobante = e.comprobante_nro?.trim() || null;
  if (comprobante) {
    const [repetida] = await db
      .select({ id: cargasGasoil.id, fecha: cargasGasoil.fecha })
      .from(cargasGasoil)
      .where(ilike(cargasGasoil.comprobante_nro, comprobante));
    if (repetida) avisos.push(`Ojo: ya hay una carga con el comprobante ${comprobante} (del ${fechaDeBase(repetida.fecha)}).`);
  }
  const conComprobante = e.usar_comprobante_adjunto && hayAdjunto;

  const etiquetasModalidad = {
    cuenta_corriente: "cuenta corriente",
    pagado_por_chofer: "lo pagó el chofer (se le devuelve)",
    surtidor_propio: "surtidor propio",
  } as const;

  return {
    ok: true,
    valor: {
      tipo: "cargar_gasoil",
      datos: {
        fecha,
        camion_id: camion.id,
        chofer_id: choferId,
        viaje_id: viajeId,
        estacion_id: e.estacion_id,
        litros: e.litros,
        precio_litro: precio,
        importe,
        modalidad,
        comprobante_nro: comprobante,
        observaciones: e.observaciones?.trim() || null,
        con_comprobante: conComprobante,
      },
      titulo: "Cargar gasoil",
      detalle: [
        `Fecha: ${fechaAr(fecha)}`,
        `Camión: ${camion.patente}${choferFinal ? ` · Chofer: ${choferFinal.nombre}` : ""}`,
        `Litros: ${num(e.litros)}${precio ? ` a ${pesos(precio)}` : ""}${importe ? ` = ${pesos(importe)}` : " (sin importe)"}`,
        `Viaje: ${viaje ? nombreViaje(viaje) : "sin viaje"}`,
        ...(estacion ? [`Estación: ${estacion.nombre}`] : []),
        ...(comprobante ? [`Comprobante N° ${comprobante}`] : []),
        `Pago: ${etiquetasModalidad[modalidad]}`,
        ...(conComprobante ? ["Se adjunta la foto del comprobante"] : []),
      ],
      avisos,
    },
  };
}

export type EntradaCarga = {
  viaje_id: number;
  fecha_carga: string | null;
  bruto_origen: number | null;
  tara_origen: number | null;
  neto_origen: number | null;
};

async function prepararCarga(e: EntradaCarga): Promise<Resultado<Propuesta>> {
  const v = await buscarViaje(e.viaje_id);
  if (!v) return { ok: false, error: `No existe un viaje con id ${e.viaje_id}.` };
  const neto = e.neto_origen ?? (e.bruto_origen && e.tara_origen ? e.bruto_origen - e.tara_origen : null);
  if (!e.fecha_carga && neto == null) return { ok: false, error: "Falta la fecha de carga o los kilos de origen." };
  if (neto != null && neto <= 0) return { ok: false, error: "El neto de origen tiene que ser mayor a cero." };
  const avisos: string[] = [];
  if (v.estado === "rechazado") avisos.push("El viaje está rechazado.");
  if (v.liquidado) avisos.push("El viaje ya está liquidado al chofer: lo que gana el chofer no se recalcula.");

  return {
    ok: true,
    valor: {
      tipo: "cargar_viaje",
      datos: { viaje_id: v.id, fecha_carga: e.fecha_carga, bruto_origen: e.bruto_origen, tara_origen: e.tara_origen, neto_origen: neto },
      titulo: `Carga del ${nombreViaje(v)}`,
      detalle: [
        ...(e.fecha_carga ? [cambio("Fecha de carga", fechaDeBase(v.fecha_carga), fechaAr(e.fecha_carga))] : []),
        ...(e.bruto_origen ? [cambio("Bruto origen", kgDeBase(v.bruto_origen), kg(e.bruto_origen))] : []),
        ...(e.tara_origen ? [cambio("Tara origen", kgDeBase(v.tara_origen), kg(e.tara_origen))] : []),
        ...(neto != null ? [cambio("Neto origen", kgDeBase(v.neto_origen), kg(neto))] : []),
      ],
      avisos,
    },
  };
}

export type EntradaDescarga = {
  viaje_id: number;
  fecha_descarga: string | null;
  bruto_destino: number | null;
  tara_destino: number | null;
  neto_destino: number | null;
  usar_comprobante_adjunto: boolean;
};

async function prepararDescarga(e: EntradaDescarga, hayAdjunto: boolean): Promise<Resultado<Propuesta>> {
  const v = await buscarViaje(e.viaje_id);
  if (!v) return { ok: false, error: `No existe un viaje con id ${e.viaje_id}.` };
  const neto = e.neto_destino ?? (e.bruto_destino && e.tara_destino ? e.bruto_destino - e.tara_destino : null);
  if (!e.fecha_descarga && neto == null) return { ok: false, error: "Falta la fecha de descarga o los kilos de destino." };
  if (neto != null && neto <= 0) return { ok: false, error: "El neto de destino tiene que ser mayor a cero." };
  const avisos: string[] = [];
  if (v.estado === "rechazado") avisos.push("El viaje está rechazado.");
  if (v.liquidado) avisos.push("El viaje ya está liquidado al chofer: lo que gana el chofer no se recalcula.");
  if (neto != null && v.neto_origen) {
    const merma = Number(v.neto_origen) - neto;
    avisos.push(`Merma: ${kg(merma)} (${num((merma / Number(v.neto_origen)) * 100)}%) contra ${kg(Number(v.neto_origen))} de origen.`);
  }
  const conComprobante = e.usar_comprobante_adjunto && hayAdjunto;

  return {
    ok: true,
    valor: {
      tipo: "descargar_viaje",
      datos: {
        viaje_id: v.id,
        fecha_descarga: e.fecha_descarga,
        bruto_destino: e.bruto_destino,
        tara_destino: e.tara_destino,
        neto_destino: neto,
        con_comprobante: conComprobante,
      },
      titulo: `Descarga del ${nombreViaje(v)}`,
      detalle: [
        ...(e.fecha_descarga ? [cambio("Fecha de descarga", fechaDeBase(v.fecha_descarga), fechaAr(e.fecha_descarga))] : []),
        ...(e.bruto_destino ? [cambio("Bruto destino", kgDeBase(v.bruto_destino), kg(e.bruto_destino))] : []),
        ...(e.tara_destino ? [cambio("Tara destino", kgDeBase(v.tara_destino), kg(e.tara_destino))] : []),
        ...(neto != null ? [cambio("Neto destino", kgDeBase(v.neto_destino), kg(neto))] : []),
        ...(conComprobante ? ["Se adjunta la foto del ticket de descarga"] : []),
      ],
      avisos,
    },
  };
}

export type EntradaTarifa = {
  viaje_id: number;
  valor_tarifa: number;
  modalidad_tarifa: "por_tonelada" | "por_km" | "por_tonelada_km" | "monto_fijo" | null;
};

const etiquetaModalidadTarifa = {
  por_tonelada: "por tonelada",
  por_km: "por km",
  por_tonelada_km: "por tonelada-km",
  monto_fijo: "monto fijo",
} as const;

async function prepararTarifa(e: EntradaTarifa): Promise<Resultado<Propuesta>> {
  const v = await buscarViaje(e.viaje_id);
  if (!v) return { ok: false, error: `No existe un viaje con id ${e.viaje_id}.` };
  if (!(e.valor_tarifa > 0)) return { ok: false, error: "La tarifa tiene que ser mayor a cero." };
  const avisos: string[] = [];
  if (v.liquidado) avisos.push("El viaje ya está liquidado al chofer: lo que gana el chofer no cambia.");
  if (v.factura_nro) avisos.push(`El viaje ya está facturado (${v.factura_nro}): el flete cambia pero la factura no.`);
  const modalidad = e.modalidad_tarifa ?? v.modalidad_tarifa;

  return {
    ok: true,
    valor: {
      tipo: "cambiar_tarifa",
      datos: { viaje_id: v.id, valor_tarifa: e.valor_tarifa, modalidad_tarifa: e.modalidad_tarifa },
      titulo: `Tarifa del ${nombreViaje(v)}`,
      detalle: [
        cambio("Tarifa", v.valor_tarifa ? pesos(Number(v.valor_tarifa)) : null, pesos(e.valor_tarifa)),
        ...(modalidad ? [`Modalidad: ${etiquetaModalidadTarifa[modalidad]}`] : []),
        ...(v.importe_flete ? [`Flete actual: ${pesos(Number(v.importe_flete))} (se recalcula al guardar)`] : []),
      ],
      avisos,
    },
  };
}

async function prepararEliminar(viajeId: number): Promise<Resultado<Propuesta>> {
  const v = await buscarViaje(viajeId);
  if (!v) return { ok: false, error: `No existe un viaje con id ${viajeId}.` };
  if (v.liquidado) return { ok: false, error: `El viaje #${v.numero} ya está liquidado al chofer: no se puede borrar.` };
  const [cobro] = await db
    .select({ id: cobroImputaciones.id })
    .from(cobroImputaciones)
    .where(eq(cobroImputaciones.viaje_id, v.id))
    .limit(1);
  if (cobro) return { ok: false, error: `El viaje #${v.numero} ya tiene un cobro imputado: no se puede borrar.` };
  const [gasoil] = await db
    .select({ id: cargasGasoil.id })
    .from(cargasGasoil)
    .where(eq(cargasGasoil.viaje_id, v.id))
    .limit(1);

  return {
    ok: true,
    valor: {
      tipo: "eliminar_viaje",
      datos: { viaje_id: v.id },
      titulo: `Borrar el ${nombreViaje(v)}`,
      detalle: [
        `Estado: ${v.estado.replace("_", " ")}`,
        ...(v.fecha_carga ? [`Cargado el ${fechaDeBase(v.fecha_carga)}`] : []),
        "Se borran también sus gastos, adicionales y adjuntos. No se puede deshacer.",
      ],
      avisos: gasoil ? ["Tiene gasoil asociado: esas cargas quedan sin viaje."] : [],
    },
  };
}

export type EntradaHerramienta =
  | { tipo: "cargar_gasoil"; entrada: EntradaGasoil }
  | { tipo: "cargar_viaje"; entrada: EntradaCarga }
  | { tipo: "descargar_viaje"; entrada: EntradaDescarga }
  | { tipo: "cambiar_tarifa"; entrada: EntradaTarifa }
  | { tipo: "eliminar_viaje"; entrada: { viaje_id: number } };

/** Arma la propuesta que se le muestra al usuario. No guarda nada. */
export async function prepararAccion(p: EntradaHerramienta, hayAdjunto: boolean): Promise<Resultado<Propuesta>> {
  let r: Resultado<Propuesta>;
  switch (p.tipo) {
    case "cargar_gasoil":
      r = await prepararGasoil(p.entrada, hayAdjunto);
      break;
    case "cargar_viaje":
      r = await prepararCarga(p.entrada);
      break;
    case "descargar_viaje":
      r = await prepararDescarga(p.entrada, hayAdjunto);
      break;
    case "cambiar_tarifa":
      r = await prepararTarifa(p.entrada);
      break;
    case "eliminar_viaje":
      r = await prepararEliminar(p.entrada.viaje_id);
      break;
  }
  if (!r.ok) return r;
  // Lo que va a ejecutarse tiene que pasar el mismo control que al confirmar.
  const valida = accionSchema.safeParse({ tipo: r.valor.tipo, datos: r.valor.datos });
  if (!valida.success) return { ok: false, error: `Datos inválidos: ${valida.error.issues[0]?.message ?? "revisalos"}.` };
  return r;
}

// ---------- Ejecutar (al tocar Confirmar) ----------

async function guardarAdjunto(entidad: "carga_gasoil" | "viaje", entidadId: number, tipo: "comprobante" | "ticket_balanza", archivo: File) {
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const nombre = archivo.name || "comprobante.jpg";
  const ruta = `${entidad}/${entidadId}/${randomUUID()}-${nombre}`;
  await subirAdjunto(ruta, buffer, archivo.type || "application/octet-stream");
  await db.insert(adjuntos).values({ entidad, entidad_id: entidadId, tipo, nombre_archivo: nombre, storage_path: ruta });
}

/**
 * Refresca las pantallas afectadas. Si falla no se corta: lo importante ya
 * se guardó, y un error acá haría que el usuario lo vuelva a confirmar
 * (y quede cargado dos veces).
 */
function refrescar(...rutas: string[]) {
  for (const ruta of rutas) {
    try {
      revalidatePath(ruta);
    } catch (err) {
      console.error("Félix: no se pudo refrescar", ruta, err);
    }
  }
}

async function recalcularViaje(viajeId: number) {
  await recalcularMerma(viajeId);
  await recalcularFlete(viajeId);
  await recalcularLiquidacionChofer(viajeId);
  await avanzarEstadoAutomatico(viajeId);
}

/**
 * Guarda una acción confirmada por el usuario, con las mismas funciones que
 * usan las pantallas de la app. Devuelve el mensaje para el chat.
 */
export async function ejecutarAccion(
  crudo: unknown,
  archivo: File | null,
  usuario: string
): Promise<{ ok: true; mensaje: string } | { ok: false; error: string }> {
  const parseado = accionSchema.safeParse(crudo);
  if (!parseado.success) return { ok: false, error: "La acción no es válida. Pedísela de nuevo a Félix." };
  const accion = parseado.data;

  switch (accion.tipo) {
    case "cargar_gasoil": {
      const d = accion.datos;
      // Se vuelve a validar como en la pantalla de Gasoil.
      const valida = cargaGasoilSchema.safeParse({
        fecha: d.fecha,
        camion_id: d.camion_id,
        chofer_id: d.chofer_id,
        viaje_id: d.viaje_id,
        estacion_id: d.estacion_id,
        litros: decimal(d.litros),
        precio_litro: d.precio_litro != null ? String(Math.round(d.precio_litro * 1000) / 1000) : undefined,
        importe: d.importe != null ? decimal(d.importe) : undefined,
        modalidad: d.modalidad,
        rendido: false,
        comprobante_nro: d.comprobante_nro ?? undefined,
        observaciones: [d.observaciones, `Cargado por Félix (${usuario})`].filter(Boolean).join(" · "),
      });
      if (!valida.success) return { ok: false, error: valida.error.issues[0]?.message ?? "Datos inválidos." };
      const [camion] = await db.select({ id: camiones.id }).from(camiones).where(eq(camiones.id, d.camion_id));
      if (!camion) return { ok: false, error: "El camión ya no existe." };
      if (d.viaje_id && !(await buscarViaje(d.viaje_id))) return { ok: false, error: "El viaje ya no existe." };
      const cargaId = await insertarCargaGasoil({ ...valida.data, fecha: fechaGuardar(d.fecha) });
      if (d.con_comprobante && archivo) await guardarAdjunto("carga_gasoil", cargaId, "comprobante", archivo);
      refrescar("/gasoil");
      const viaje = d.viaje_id ? await buscarViaje(d.viaje_id) : null;
      return {
        ok: true,
        mensaje: `Cargué ${num(d.litros)} L de gasoil${d.importe ? ` por ${pesos(d.importe)}` : ""}${viaje ? ` al viaje #${viaje.numero}` : ""}.${d.con_comprobante && !archivo ? " La foto del comprobante no llegó: adjuntala desde Gasoil." : ""}`,
      };
    }

    case "cargar_viaje": {
      const d = accion.datos;
      const v = await buscarViaje(d.viaje_id);
      if (!v) return { ok: false, error: "El viaje ya no existe." };
      await db
        .update(viajes)
        .set({
          ...(d.fecha_carga ? { fecha_carga: fechaGuardar(d.fecha_carga) } : {}),
          ...(d.bruto_origen != null ? { bruto_origen: decimal(d.bruto_origen) } : {}),
          ...(d.tara_origen != null ? { tara_origen: decimal(d.tara_origen) } : {}),
          ...(d.neto_origen != null ? { neto_origen: decimal(d.neto_origen) } : {}),
          actualizado_en: new Date(),
        })
        .where(eq(viajes.id, v.id));
      await recalcularViaje(v.id);
      refrescar(`/viajes/${v.id}`, "/viajes");
      return { ok: true, mensaje: `Listo, quedó cargada la carga del viaje #${v.numero}.` };
    }

    case "descargar_viaje": {
      const d = accion.datos;
      const v = await buscarViaje(d.viaje_id);
      if (!v) return { ok: false, error: "El viaje ya no existe." };
      await db
        .update(viajes)
        .set({
          ...(d.fecha_descarga ? { fecha_descarga: fechaGuardar(d.fecha_descarga) } : {}),
          ...(d.bruto_destino != null ? { bruto_destino: decimal(d.bruto_destino) } : {}),
          ...(d.tara_destino != null ? { tara_destino: decimal(d.tara_destino) } : {}),
          ...(d.neto_destino != null ? { neto_destino: decimal(d.neto_destino) } : {}),
          actualizado_en: new Date(),
        })
        .where(eq(viajes.id, v.id));
      await recalcularViaje(v.id);
      if (d.con_comprobante && archivo) await guardarAdjunto("viaje", v.id, "ticket_balanza", archivo);
      refrescar(`/viajes/${v.id}`, "/viajes");
      return { ok: true, mensaje: `Listo, quedó cargada la descarga del viaje #${v.numero}.` };
    }

    case "cambiar_tarifa": {
      const d = accion.datos;
      const v = await buscarViaje(d.viaje_id);
      if (!v) return { ok: false, error: "El viaje ya no existe." };
      await db
        .update(viajes)
        .set({
          valor_tarifa: decimal(d.valor_tarifa),
          ...(d.modalidad_tarifa ? { modalidad_tarifa: d.modalidad_tarifa } : {}),
          actualizado_en: new Date(),
        })
        .where(eq(viajes.id, v.id));
      await recalcularFlete(v.id);
      await recalcularLiquidacionChofer(v.id);
      refrescar(`/viajes/${v.id}`, "/viajes");
      const [despues] = await db.select({ flete: viajes.importe_flete }).from(viajes).where(eq(viajes.id, v.id));
      return {
        ok: true,
        mensaje: `Listo, el viaje #${v.numero} quedó con tarifa ${pesos(d.valor_tarifa)}${despues?.flete ? ` (flete ${pesos(Number(despues.flete))})` : ""}.`,
      };
    }

    case "eliminar_viaje": {
      const v = await buscarViaje(accion.datos.viaje_id);
      if (!v) return { ok: false, error: "El viaje ya no existe (quizás ya se borró)." };
      const r = await borrarViaje(v.id);
      if (r?.error) return { ok: false, error: r.error };
      refrescar("/viajes");
      return { ok: true, mensaje: `Listo, borré el viaje #${v.numero}.` };
    }
  }
}
