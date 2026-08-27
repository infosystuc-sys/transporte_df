"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  adjuntos,
  cobroImputaciones,
  tiposGasto,
  tipoAdjuntoEnum,
  viajeAdicionales,
  viajeContingencias,
  viajeGastos,
  viajes,
} from "@/db/schema";
import { eliminarAdjunto, subirAdjunto } from "@/lib/supabase/storage";
import {
  viajeAdicionalSchema,
  viajeCargaSchema,
  viajeContingenciaSchema,
  viajeDatosGeneralesSchema,
  viajeDescargaSchema,
  viajeFacturacionSchema,
  viajeGastoSchema,
  viajeTarifaSchema,
  type ViajeAdicionalInput,
  type ViajeCargaInput,
  type ViajeContingenciaInput,
  type ViajeDatosGeneralesInput,
  type ViajeDescargaInput,
  type ViajeFacturacionInput,
  type ViajeGastoInput,
  type ViajeTarifaInput,
} from "@/lib/schemas/viajes";

import type { EstadoViaje } from "./_lib/estados";
import { recalcularMerma } from "./_lib/merma";
import { recalcularFlete } from "./_lib/flete";
import { recalcularCobro } from "./_lib/cobro";
import { recalcularLiquidacionChofer } from "./_lib/liquidacion";
import { avanzarEstadoAutomatico } from "./_lib/avance-estado";
import { registrarMovimientoAutomatico } from "@/lib/cuenta-corriente/movimientos";

function rutaViaje(id: number) {
  return `/viajes/${id}`;
}

export async function crearViaje(valores: ViajeDatosGeneralesInput) {
  const datos = viajeDatosGeneralesSchema.parse(valores);
  const [viaje] = await db.insert(viajes).values(datos).returning({ id: viajes.id });
  revalidatePath("/viajes");
  redirect(`/viajes/${viaje.id}`);
}

/**
 * Igual que crearViaje, pero deja el viaje nuevo marcado como reemplazo del
 * que se rechazó (ver rechazarViaje). viaje_reemplaza_a_id no es un campo
 * del formulario de datos generales, así que se recibe aparte y no pasa
 * por viajeDatosGeneralesSchema.
 */
export async function crearViajeReemplazo(
  reemplazaAId: number,
  valores: ViajeDatosGeneralesInput
) {
  const datos = viajeDatosGeneralesSchema.parse(valores);
  const [viaje] = await db
    .insert(viajes)
    .values({ ...datos, viaje_reemplaza_a_id: reemplazaAId })
    .returning({ id: viajes.id });
  revalidatePath("/viajes");
  redirect(`/viajes/${viaje.id}`);
}

export async function actualizarDatosGenerales(
  id: number,
  valores: ViajeDatosGeneralesInput
): Promise<{ error?: string } | void> {
  const datos = viajeDatosGeneralesSchema.parse(valores);
  await db
    .update(viajes)
    .set({ ...datos, actualizado_en: new Date() })
    .where(eq(viajes.id, id));
  await recalcularFlete(id);
  await recalcularLiquidacionChofer(id);
  revalidatePath(rutaViaje(id));
}

export async function actualizarCarga(
  id: number,
  valores: ViajeCargaInput
): Promise<{ error?: string } | void> {
  const datos = viajeCargaSchema.parse(valores);
  await db
    .update(viajes)
    .set({ ...datos, actualizado_en: new Date() })
    .where(eq(viajes.id, id));
  await recalcularMerma(id);
  await recalcularFlete(id);
  await recalcularLiquidacionChofer(id);
  await avanzarEstadoAutomatico(id);
  revalidatePath(rutaViaje(id));
}

export async function actualizarDescarga(
  id: number,
  valores: ViajeDescargaInput
): Promise<{ error?: string } | void> {
  const datos = viajeDescargaSchema.parse(valores);
  await db
    .update(viajes)
    .set({ ...datos, actualizado_en: new Date() })
    .where(eq(viajes.id, id));
  await recalcularMerma(id);
  await recalcularFlete(id);
  await recalcularLiquidacionChofer(id);
  await avanzarEstadoAutomatico(id);
  revalidatePath(rutaViaje(id));
}

/**
 * Igual que actualizarDescarga, pero además adjunta el ticket de balanza
 * que se usó para precargar el formulario por IA (mismo patrón que
 * crearCargaGasoilConAdjunto en gasoil/actions.ts) -- así queda guardado
 * como adjunto del viaje sin que el usuario tenga que subirlo de nuevo a
 * mano desde la pestaña Adjuntos.
 */
export async function actualizarDescargaConAdjunto(
  id: number,
  formData: FormData
): Promise<{ error?: string } | void> {
  const archivo = formData.get("archivo");
  const datosJson = formData.get("datos");
  if (!(archivo instanceof File) || typeof datosJson !== "string") {
    return { error: "Faltan datos." };
  }

  const datos = viajeDescargaSchema.parse(JSON.parse(datosJson) as ViajeDescargaInput);
  await db
    .update(viajes)
    .set({ ...datos, actualizado_en: new Date() })
    .where(eq(viajes.id, id));
  await recalcularMerma(id);
  await recalcularFlete(id);
  await recalcularLiquidacionChofer(id);
  await avanzarEstadoAutomatico(id);

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const rutaStorage = `viaje/${id}/${randomUUID()}-${archivo.name}`;
  await subirAdjunto(rutaStorage, buffer, archivo.type || "application/octet-stream");
  await db.insert(adjuntos).values({
    entidad: "viaje",
    entidad_id: id,
    tipo: "ticket_balanza",
    nombre_archivo: archivo.name,
    storage_path: rutaStorage,
  });

  revalidatePath(rutaViaje(id));
}

export async function actualizarTarifa(
  id: number,
  valores: ViajeTarifaInput
): Promise<{ error?: string } | void> {
  const datos = viajeTarifaSchema.parse(valores);
  await db
    .update(viajes)
    .set({ ...datos, actualizado_en: new Date() })
    .where(eq(viajes.id, id));
  await recalcularFlete(id);
  await recalcularLiquidacionChofer(id);
  revalidatePath(rutaViaje(id));
}

export async function actualizarFacturacion(
  id: number,
  valores: ViajeFacturacionInput
): Promise<{ error?: string } | void> {
  const datos = viajeFacturacionSchema.parse(valores);
  await db
    .update(viajes)
    .set({ ...datos, actualizado_en: new Date() })
    .where(eq(viajes.id, id));
  await recalcularCobro(id);
  await avanzarEstadoAutomatico(id);
  revalidatePath(rutaViaje(id));
}

/**
 * Los gastos, adicionales y contingencias del viaje se borran solos (FK en
 * cascada), pero si ya tiene un cobro imputado o entró en una liquidación
 * no se deja borrar -- son registros contables que ya salieron del viaje
 * y romperían esos otros módulos. Los adjuntos no tienen FK real (la
 * tabla es polimórfica) así que hay que limpiarlos a mano, storage
 * incluido, o quedan huérfanos apuntando a un viaje que ya no existe.
 */
export async function eliminarViaje(id: number): Promise<{ error?: string } | void> {
  const [viaje] = await db.select({ liquidado: viajes.liquidado }).from(viajes).where(eq(viajes.id, id));
  if (!viaje) return;

  if (viaje.liquidado) {
    return { error: "No se puede eliminar: el viaje ya está liquidado. Sacalo de la liquidación primero." };
  }

  const [imputacion] = await db
    .select({ id: cobroImputaciones.id })
    .from(cobroImputaciones)
    .where(eq(cobroImputaciones.viaje_id, id))
    .limit(1);
  if (imputacion) {
    return { error: "No se puede eliminar: el viaje ya tiene un cobro imputado. Corregí el cobro primero." };
  }

  const filasAdjuntos = await db
    .select({ storage_path: adjuntos.storage_path })
    .from(adjuntos)
    .where(and(eq(adjuntos.entidad, "viaje"), eq(adjuntos.entidad_id, id)));
  for (const a of filasAdjuntos) {
    await eliminarAdjunto(a.storage_path).catch(() => {});
  }
  await db.delete(adjuntos).where(and(eq(adjuntos.entidad, "viaje"), eq(adjuntos.entidad_id, id)));

  await db.delete(viajes).where(eq(viajes.id, id));
  revalidatePath("/viajes");
  redirect("/viajes");
}

/**
 * Avanza o retrocede un paso en la máquina de estados, validando los
 * mínimos que pide el spec: fecha de descarga para "descargado", N° de
 * factura para "facturado", un cobro imputado para "cobrado".
 */
export async function cambiarEstadoViaje(
  id: number,
  nuevoEstado: EstadoViaje,
  facturaNro?: string
) {
  const [viaje] = await db.select().from(viajes).where(eq(viajes.id, id));
  if (!viaje) return { error: "Viaje no encontrado." };

  if (nuevoEstado === "descargado" && !viaje.fecha_descarga) {
    return {
      error:
        "No se puede pasar a Descargado sin fecha de descarga. Completala en la pestaña \"Descarga y merma\" y guardá: el estado avanza solo, no hace falta volver a tocar este botón.",
    };
  }

  if (nuevoEstado === "facturado") {
    const nro = facturaNro?.trim() || viaje.factura_nro;
    if (!nro) return { error: "No se puede pasar a Facturado sin N° de factura." };
    await db
      .update(viajes)
      .set({ estado: nuevoEstado, factura_nro: nro, facturado: true, actualizado_en: new Date() })
      .where(eq(viajes.id, id));
    await recalcularCobro(id);
    revalidatePath(rutaViaje(id));
    revalidatePath("/viajes");
    return;
  }

  if (nuevoEstado === "cobrado") {
    const imputaciones = await db
      .select()
      .from(cobroImputaciones)
      .where(eq(cobroImputaciones.viaje_id, id));
    if (imputaciones.length === 0) {
      return {
        error:
          "No se puede pasar a Cobrado sin un cobro imputado. Registralo desde Cobros → Nuevo cobro: el estado avanza solo, no hace falta volver a tocar este botón.",
      };
    }
  }

  if (nuevoEstado === "liquidado" && !viaje.liquidado) {
    return {
      error:
        "No se puede pasar a Liquidado sin incluir el viaje en una liquidación. Hacelo desde Liquidaciones → Nueva liquidación: el estado avanza solo, no hace falta volver a tocar este botón.",
    };
  }

  await db
    .update(viajes)
    .set({ estado: nuevoEstado, actualizado_en: new Date() })
    .where(eq(viajes.id, id));
  revalidatePath(rutaViaje(id));
  revalidatePath("/viajes");
}

/**
 * El destino rechazó la carga: el viaje queda cerrado en un estado
 * terminal alternativo (no forma parte de la secuencia lineal de
 * cambiarEstadoViaje, y no se reabre ni se reintenta — la operación sigue
 * en un viaje nuevo, ver crearViajeReemplazo). Deja registrado el motivo
 * como una contingencia más, reusando el campo descripcion existente.
 */
export async function rechazarViaje(
  id: number,
  motivo: string
): Promise<{ error?: string } | void> {
  const descripcion = motivo.trim();
  if (!descripcion) return { error: "Ingresá el motivo del rechazo." };

  await db
    .update(viajes)
    .set({ estado: "rechazado", actualizado_en: new Date() })
    .where(eq(viajes.id, id));
  await db.insert(viajeContingencias).values({
    viaje_id: id,
    descripcion,
    fecha: new Date(),
  });
  revalidatePath(rutaViaje(id));
  revalidatePath("/viajes");
}

// viaje_contingencias
export async function crearContingencia(
  viajeId: number,
  valores: ViajeContingenciaInput
): Promise<{ error?: string } | void> {
  const datos = viajeContingenciaSchema.parse(valores);
  await db.insert(viajeContingencias).values({ ...datos, viaje_id: viajeId });
  revalidatePath(rutaViaje(viajeId));
}

export async function eliminarContingencia(
  id: number,
  viajeId: number
): Promise<{ error?: string } | void> {
  await db.delete(viajeContingencias).where(eq(viajeContingencias.id, id));
  revalidatePath(rutaViaje(viajeId));
}

/**
 * Sube el comprobante de un gasto/adicional/carga de gasoil como adjunto
 * del viaje. Se usa desde las variantes "con adjunto" de crearAdicional y
 * crearGasto — a diferencia de gasoil (que sí tiene su propia entidad
 * "carga_gasoil" en entidad_adjunto), acá no hay una entidad específica
 * para "viaje_gasto"/"viaje_adicional", así que el adjunto queda a nivel
 * del viaje completo, igual que el resto de sus adjuntos.
 */
async function adjuntarComprobante(viajeId: number, archivo: File) {
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const rutaStorage = `viaje/${viajeId}/${randomUUID()}-${archivo.name}`;
  await subirAdjunto(rutaStorage, buffer, archivo.type || "application/octet-stream");
  await db.insert(adjuntos).values({
    entidad: "viaje",
    entidad_id: viajeId,
    tipo: "comprobante",
    nombre_archivo: archivo.name,
    storage_path: rutaStorage,
  });
}

function archivoYDatosDeFormData<T>(formData: FormData): { archivo: File; datos: T } | { error: string } {
  const archivo = formData.get("archivo");
  const datosJson = formData.get("datos");
  if (!(archivo instanceof File) || typeof datosJson !== "string") {
    return { error: "Faltan datos." };
  }
  return { archivo, datos: JSON.parse(datosJson) as T };
}

// viaje_adicionales
async function insertarAdicional(viajeId: number, datos: ReturnType<typeof viajeAdicionalSchema.parse>) {
  await db.insert(viajeAdicionales).values({ ...datos, viaje_id: viajeId });
  // No recalcula la liquidación del chofer: los adicionales solo afectan
  // importe_adicionales/total_a_cobrar (lo que se le cobra al cliente), no
  // importe_flete (la base de la liquidación).
  await recalcularFlete(viajeId);
}

export async function crearAdicional(
  viajeId: number,
  valores: ViajeAdicionalInput
): Promise<{ error?: string } | void> {
  const datos = viajeAdicionalSchema.parse(valores);
  await insertarAdicional(viajeId, datos);
  revalidatePath(rutaViaje(viajeId));
}

/** Igual que crearAdicional, pero además guarda el comprobante (subido
 * para la carga por IA, ej. de estadía) como adjunto del viaje. */
export async function crearAdicionalConAdjunto(
  viajeId: number,
  formData: FormData
): Promise<{ error?: string } | void> {
  const entrada = archivoYDatosDeFormData<ViajeAdicionalInput>(formData);
  if ("error" in entrada) return entrada;

  const datos = viajeAdicionalSchema.parse(entrada.datos);
  await insertarAdicional(viajeId, datos);
  await adjuntarComprobante(viajeId, entrada.archivo);
  revalidatePath(rutaViaje(viajeId));
}

export async function eliminarAdicional(
  id: number,
  viajeId: number
): Promise<{ error?: string } | void> {
  await db.delete(viajeAdicionales).where(eq(viajeAdicionales.id, id));
  await recalcularFlete(viajeId);
  revalidatePath(rutaViaje(viajeId));
}

// viaje_gastos
async function insertarGasto(viajeId: number, datos: ReturnType<typeof viajeGastoSchema.parse>) {
  await db.insert(viajeGastos).values({ ...datos, viaje_id: viajeId });

  // Si lo pagó el chofer y todavía no fue rendido, genera un movimiento a
  // su favor en la cuenta corriente (spec 3.2).
  if (datos.pagado_por === "chofer" && !datos.rendido) {
    const [viaje] = await db.select().from(viajes).where(eq(viajes.id, viajeId));
    if (viaje?.chofer_id) {
      const [tipoGasto] = await db
        .select()
        .from(tiposGasto)
        .where(eq(tiposGasto.id, datos.tipo_gasto_id));
      await registrarMovimientoAutomatico({
        chofer_id: viaje.chofer_id,
        tipo: "gasto_rendido",
        importe: datos.importe,
        viaje_id: viajeId,
        descripcion: `Gasto de viaje: ${tipoGasto?.nombre ?? "sin tipo"}`,
      });
    }
  }
}

export async function crearGasto(
  viajeId: number,
  valores: ViajeGastoInput
): Promise<{ error?: string } | void> {
  const datos = viajeGastoSchema.parse(valores);
  await insertarGasto(viajeId, datos);
  revalidatePath(rutaViaje(viajeId));
}

/** Igual que crearGasto, pero además guarda el comprobante (subido para
 * la carga por IA) como adjunto del viaje. */
export async function crearGastoConAdjunto(
  viajeId: number,
  formData: FormData
): Promise<{ error?: string } | void> {
  const entrada = archivoYDatosDeFormData<ViajeGastoInput>(formData);
  if ("error" in entrada) return entrada;

  const datos = viajeGastoSchema.parse(entrada.datos);
  await insertarGasto(viajeId, datos);
  await adjuntarComprobante(viajeId, entrada.archivo);
  revalidatePath(rutaViaje(viajeId));
}

export async function eliminarGasto(
  id: number,
  viajeId: number
): Promise<{ error?: string } | void> {
  await db.delete(viajeGastos).where(eq(viajeGastos.id, id));
  revalidatePath(rutaViaje(viajeId));
}

// adjuntos
export async function subirAdjuntoManual(
  viajeId: number,
  formData: FormData
): Promise<{ error?: string } | void> {
  const archivo = formData.get("archivo");
  const tipo = formData.get("tipo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí un archivo." };
  }
  if (typeof tipo !== "string" || !tipoAdjuntoEnum.enumValues.includes(tipo as never)) {
    return { error: "Elegí un tipo de adjunto." };
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const rutaStorage = `viaje/${viajeId}/${randomUUID()}-${archivo.name}`;
  await subirAdjunto(rutaStorage, buffer, archivo.type || "application/octet-stream");
  await db.insert(adjuntos).values({
    entidad: "viaje",
    entidad_id: viajeId,
    tipo: tipo as (typeof tipoAdjuntoEnum.enumValues)[number],
    nombre_archivo: archivo.name,
    storage_path: rutaStorage,
  });
  revalidatePath(rutaViaje(viajeId));
}

export async function eliminarAdjuntoViaje(
  id: number,
  viajeId: number,
  storagePath: string
): Promise<{ error?: string } | void> {
  await eliminarAdjunto(storagePath);
  await db.delete(adjuntos).where(eq(adjuntos.id, id));
  revalidatePath(rutaViaje(viajeId));
}
