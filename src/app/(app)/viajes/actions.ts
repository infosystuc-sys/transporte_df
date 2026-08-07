"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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
  revalidatePath(rutaViaje(id));
}

export async function eliminarViaje(id: number) {
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
    return { error: "No se puede pasar a Descargado sin fecha de descarga." };
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
      return { error: "No se puede pasar a Cobrado sin un cobro imputado." };
    }
  }

  if (nuevoEstado === "liquidado" && !viaje.liquidado) {
    return { error: "No se puede pasar a Liquidado sin incluir el viaje en una liquidación." };
  }

  await db
    .update(viajes)
    .set({ estado: nuevoEstado, actualizado_en: new Date() })
    .where(eq(viajes.id, id));
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

// viaje_adicionales
export async function crearAdicional(
  viajeId: number,
  valores: ViajeAdicionalInput
): Promise<{ error?: string } | void> {
  const datos = viajeAdicionalSchema.parse(valores);
  await db.insert(viajeAdicionales).values({ ...datos, viaje_id: viajeId });
  // No recalcula la liquidación del chofer: los adicionales solo afectan
  // importe_adicionales/total_a_cobrar (lo que se le cobra al cliente), no
  // importe_flete (la base de la liquidación).
  await recalcularFlete(viajeId);
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
export async function crearGasto(
  viajeId: number,
  valores: ViajeGastoInput
): Promise<{ error?: string } | void> {
  const datos = viajeGastoSchema.parse(valores);
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
