"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adjuntos, clientes, cobroImputaciones, viajes } from "@/db/schema";
import { subirAdjunto } from "@/lib/supabase/storage";
import { procesarLp, type ResultadoLp } from "@/lib/lp/importar";
import { nroFacturaLp } from "@/lib/lp/comparar";
import { recalcularFlete } from "../_lib/flete";
import { recalcularLiquidacionChofer } from "../_lib/liquidacion";
import { recalcularCobro } from "../_lib/cobro";
import { avanzarEstadoAutomatico } from "../_lib/avance-estado";

function archivoDeFormData(formData: FormData) {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) throw new Error("Falta el archivo del líquido producto.");
  return archivo;
}

/** Lee el LP y busca sus viajes. No guarda nada todavía. */
export async function leerLp(formData: FormData): Promise<ResultadoLp> {
  const archivo = archivoDeFormData(formData);
  return procesarLp(Buffer.from(await archivo.arrayBuffer()));
}

const confirmacionSchema = z.object({
  numero: z.string().trim().min(1, { error: "Falta el número del líquido producto." }),
  fecha: z.coerce.date({ error: "Falta la fecha del líquido producto." }),
  emisor_id: z.number().int(),
  /** IVA / neto gravado del comprobante, para repartir el IVA por viaje. */
  alicuota_iva: z.number().min(0).max(1),
  lineas: z
    .array(
      z.object({
        viaje_id: z.number().int(),
        total: z.number(),
        comision: z.number().min(0),
        otros_descuentos: z.number().min(0),
      })
    )
    .min(1, { error: "Elegí al menos un viaje para confirmar." }),
});
export type ConfirmacionLp = z.input<typeof confirmacionSchema>;

/**
 * Registra el LP como la facturación de cada viaje elegido (N° "LP …",
 * fecha, neto, IVA y total de su línea) y lo deja como "facturado":
 * - el cliente del viaje pasa a ser el emisor del LP, que es quien paga
 *   el flete, salvo que el viaje ya tenga cobros imputados (esos cobros
 *   son del cliente anterior y quedarían colgados);
 * - si el LP descuenta comisión, el emisor queda como intermediario con
 *   el % que surge del LP, para que total a cobrar coincida;
 * - el PDF queda adjunto en cada viaje.
 * Los kilos y la tarifa del viaje no se tocan: si difieren, la pantalla
 * de revisión ya lo mostró y se corrigen a mano en el viaje.
 */
export async function confirmarLp(formData: FormData): Promise<{ error?: string; confirmados?: number }> {
  const archivo = archivoDeFormData(formData);
  const parseado = confirmacionSchema.safeParse(JSON.parse(String(formData.get("datos") ?? "{}")));
  if (!parseado.success) return { error: parseado.error.issues[0]?.message ?? "Datos inválidos." };
  const datos = parseado.data;
  const nroFactura = nroFacturaLp(datos.numero);

  const [emisor] = await db.select({ id: clientes.id }).from(clientes).where(eq(clientes.id, datos.emisor_id));
  if (!emisor) return { error: "El cliente emisor del líquido producto ya no existe." };

  const ids = datos.lineas.map((l) => l.viaje_id);
  if (new Set(ids).size !== ids.length) return { error: "El mismo viaje quedó elegido en dos líneas del LP." };
  const filas = await db
    .select({ id: viajes.id, cliente_id: viajes.cliente_id, factura_nro: viajes.factura_nro })
    .from(viajes)
    .where(inArray(viajes.id, ids));
  if (filas.length !== ids.length) return { error: "Algún viaje elegido ya no existe. Volvé a leer el archivo." };
  const yaFacturado = filas.find((f) => f.factura_nro && f.factura_nro !== nroFactura);
  if (yaFacturado) {
    return { error: `Un viaje elegido ya está facturado con ${yaFacturado.factura_nro}. Volvé a leer el archivo.` };
  }
  // Volver a confirmar el mismo LP no duplica adjuntos ni recalcula nada.
  const yaImportados = new Set(filas.filter((f) => f.factura_nro === nroFactura).map((f) => f.id));
  const pendientes = datos.lineas.filter((l) => !yaImportados.has(l.viaje_id));
  if (pendientes.length === 0) return { confirmados: 0 };

  const conCobros = new Set(
    (
      await db
        .selectDistinct({ viaje_id: cobroImputaciones.viaje_id })
        .from(cobroImputaciones)
        .where(inArray(cobroImputaciones.viaje_id, ids))
    ).map((f) => f.viaje_id)
  );

  const pdf = Buffer.from(await archivo.arrayBuffer());

  for (const linea of pendientes) {
    const neto = linea.total - linea.comision - linea.otros_descuentos;
    const iva = neto * datos.alicuota_iva;

    await db
      .update(viajes)
      .set({
        ...(conCobros.has(linea.viaje_id) ? {} : { cliente_id: emisor.id }),
        ...(linea.comision > 0 && linea.total > 0
          ? {
              intermediario_id: emisor.id,
              comision_intermediario_pct: ((linea.comision / linea.total) * 100).toFixed(3),
            }
          : {}),
        factura_nro: nroFactura,
        factura_fecha: datos.fecha,
        factura_importe_neto: neto.toFixed(2),
        factura_iva: iva.toFixed(2),
        factura_importe_total: (neto + iva).toFixed(2),
        facturado: true,
        actualizado_en: new Date(),
      })
      .where(eq(viajes.id, linea.viaje_id));
    await recalcularFlete(linea.viaje_id);
    await recalcularLiquidacionChofer(linea.viaje_id);
    await recalcularCobro(linea.viaje_id);
    await avanzarEstadoAutomatico(linea.viaje_id);

    // Un archivo por viaje: al borrar un viaje se borra su adjunto de
    // Storage, y compartirlo dejaría a los otros viajes sin el PDF.
    const ruta = `viaje/${linea.viaje_id}/${randomUUID()}-${archivo.name}`;
    await subirAdjunto(ruta, pdf, archivo.type || "application/pdf");
    await db.insert(adjuntos).values({
      entidad: "viaje",
      entidad_id: linea.viaje_id,
      tipo: "factura",
      nombre_archivo: archivo.name,
      storage_path: ruta,
    });
    revalidatePath(`/viajes/${linea.viaje_id}`);
  }

  revalidatePath("/viajes");
  revalidatePath(`/clientes/${emisor.id}`);
  return { confirmados: pendientes.length };
}
