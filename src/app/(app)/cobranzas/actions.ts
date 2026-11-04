"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { liquidosProducto } from "@/db/schema";
import { urlFirmadaAdjunto } from "@/lib/supabase/storage";
import { cargarLiquidoProducto, eliminarLiquidoProducto, vincularPendientes, type ResultadoCargaLp } from "@/lib/lp/vincular";
import { desmarcarLpPagado, marcarLpPagados, type PagoLpInput } from "@/lib/lp/pagos";

function refrescar() {
  revalidatePath("/cobranzas");
  revalidatePath("/cobranzas/cobros");
  revalidatePath("/viajes");
  revalidatePath("/dashboard");
}

/** Lee un LP, lo guarda y vincula sus Cartas de Porte con los viajes. */
export async function cargarLp(formData: FormData): Promise<ResultadoCargaLp> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return { ok: false, error: "Falta el archivo del líquido producto." };
  const numero = formData.get("numero");
  try {
    const r = await cargarLiquidoProducto(
      { nombre: archivo.name, tipo: archivo.type, buffer: Buffer.from(await archivo.arrayBuffer()) },
      typeof numero === "string" ? numero : undefined
    );
    if (r.ok) refrescar();
    return r;
  } catch (err) {
    console.error("cargarLp falló:", err);
    return { ok: false, error: "No se pudo guardar el líquido producto. Probá de nuevo en un rato." };
  }
}

export async function marcarPagados(datos: PagoLpInput): Promise<{ error?: string; cobros?: number }> {
  const r = await marcarLpPagados(datos);
  if (!r.error) refrescar();
  return r;
}

export async function desmarcarPagado(lpId: number): Promise<{ error?: string; desmarcados?: string[] }> {
  const r = await desmarcarLpPagado(lpId);
  if (!r.error) refrescar();
  return r;
}

export async function eliminarLp(lpId: number): Promise<{ error?: string }> {
  const r = await eliminarLiquidoProducto(lpId);
  if (!r.error) refrescar();
  return r;
}

/** Vuelve a buscar los viajes de las CPE que quedaron sin vincular (ej. el viaje se cargó después). */
export async function revincularLp(lpId: number): Promise<{ avisos: string[] }> {
  const avisos = await vincularPendientes(lpId);
  refrescar();
  return { avisos };
}

export async function urlPdfLp(lpId: number): Promise<{ url?: string; error?: string }> {
  const [lp] = await db.select({ ruta: liquidosProducto.storage_path }).from(liquidosProducto).where(eq(liquidosProducto.id, lpId));
  if (!lp?.ruta) return { error: "Este líquido producto no tiene el PDF guardado." };
  return { url: await urlFirmadaAdjunto(lp.ruta, 600) };
}
