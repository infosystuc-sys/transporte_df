"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ilike } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db } from "@/db";
import { productos, viajes } from "@/db/schema";
import { buscarLugarPorNombre } from "@/lib/lugares/buscar";
import { parsearHojaHistorica, type FilaHistoricaExtraida } from "@/lib/importador-historico/parser";
import {
  confirmarImportacionHistoricaSchema,
  type ConfirmarImportacionHistoricaInput,
} from "@/lib/schemas/importador-historico";
import { recalcularMerma } from "../_lib/merma";
import { recalcularFlete } from "../_lib/flete";

export type FilaHistoricaConCoincidencias = FilaHistoricaExtraida & {
  origen_id: number | null;
  destino_id: number | null;
};

export type HojaHistoricaProcesada = {
  hoja: string;
  productoSugerido: string | null;
  productoIdSugerido: number | null;
  filasOmitidas: number;
  filas: FilaHistoricaConCoincidencias[];
};

/** Lee el .xlsx y arma la vista previa (hoja por hoja). No guarda nada todavía. */
export async function previsualizarExcelHistorico(formData: FormData): Promise<HojaHistoricaProcesada[]> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) throw new Error("Falta el archivo Excel.");

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const libro = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const resultado: HojaHistoricaProcesada[] = [];
  for (const nombreHoja of libro.SheetNames) {
    const hoja = libro.Sheets[nombreHoja];
    const filasCrudas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: null });
    const parseada = parsearHojaHistorica(nombreHoja, filasCrudas);
    if (parseada.filas.length === 0) continue;

    const [productoIdSugerido, filasConLugares] = await Promise.all([
      parseada.productoSugerido
        ? db
            .select({ id: productos.id })
            .from(productos)
            .where(ilike(productos.nombre, parseada.productoSugerido))
            .then((r) => r[0]?.id ?? null)
        : Promise.resolve(null),
      Promise.all(
        parseada.filas.map(async (f) => ({
          ...f,
          origen_id: await buscarLugarPorNombre(f.origen_nombre),
          destino_id: await buscarLugarPorNombre(f.destino_nombre),
        }))
      ),
    ]);

    resultado.push({
      hoja: parseada.hoja,
      productoSugerido: parseada.productoSugerido,
      productoIdSugerido,
      filasOmitidas: parseada.filasOmitidas,
      filas: filasConLugares,
    });
  }

  return resultado;
}

/**
 * Inserta los viajes revisados y confirmados. Cada uno queda marcado
 * importado_de_excel = true para no mezclarse con la carga diaria nueva.
 * El "15% chofer" de la planilla se guarda tal cual como snapshot
 * informativo (no se recalcula: la planilla no identifica chofer/camión
 * por fila, así que no hay de dónde derivarlo de nuevo).
 */
export async function confirmarImportacionHistorica(
  valores: ConfirmarImportacionHistoricaInput
): Promise<{ error?: string } | void> {
  const datos = confirmarImportacionHistoricaSchema.parse(valores);

  const filasParaInsertar = datos.filas.map((f) => ({
    cliente_id: f.cliente_id,
    producto_id: f.producto_id ?? undefined,
    origen_id: f.origen_id ?? undefined,
    destino_id: f.destino_id ?? undefined,
    camion_id: f.camion_id ?? undefined,
    chofer_id: f.chofer_id ?? undefined,
    tipo_carga: "grano" as const,
    tiene_cpe: !!f.ctg,
    ctg: f.ctg ?? undefined,
    fecha_carga: f.fecha_carga ? new Date(f.fecha_carga) : undefined,
    modalidad_tarifa: "por_tonelada" as const,
    base_calculo: "destino" as const,
    valor_tarifa: f.valor_tarifa != null ? String(f.valor_tarifa) : undefined,
    neto_origen: f.tn_origen != null ? String(f.tn_origen * 1000) : undefined,
    neto_destino: f.tn_destino != null ? String(f.tn_destino * 1000) : undefined,
    importe_liquidacion_chofer: f.importe_liquidacion_chofer != null ? String(f.importe_liquidacion_chofer) : undefined,
    estado: f.estado,
    importado_de_excel: true,
  }));

  const insertados = await db.insert(viajes).values(filasParaInsertar).returning({ id: viajes.id });

  for (const { id } of insertados) {
    await recalcularMerma(id);
    await recalcularFlete(id);
  }

  revalidatePath("/viajes");
  redirect(`/viajes?importado_de_excel=1`);
}
