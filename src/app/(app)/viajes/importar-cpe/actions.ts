"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { adjuntos, camiones, choferes, clientes, lugares, viajes } from "@/db/schema";
import { clienteSchema, type ClienteInput } from "@/lib/schemas/clientes";
import { camionSchema, choferSchema, type CamionInput, type ChoferInput } from "@/lib/schemas/flota";
import { lugarSchema, type LugarInput } from "@/lib/schemas/lugares";
import { viajeDesdeCpeSchema, type ViajeDesdeCpeInput } from "@/lib/schemas/cpe-importacion";
import { procesarCpe, type ResultadoImportacionCpe } from "@/lib/cpe/importar";
import { subirAdjunto } from "@/lib/supabase/storage";
import { recalcularMerma } from "../_lib/merma";
import { recalcularFlete } from "../_lib/flete";
import { recalcularLiquidacionChofer } from "../_lib/liquidacion";

function archivoDeFormData(formData: FormData): File {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) throw new Error("Falta el archivo PDF.");
  return archivo;
}

/** Corre la cascada texto → QR → Claude + matching. No guarda nada todavía. */
export async function importarCpe(formData: FormData): Promise<ResultadoImportacionCpe> {
  const archivo = archivoDeFormData(formData);
  const buffer = Buffer.from(await archivo.arrayBuffer());
  return procesarCpe(buffer);
}

/**
 * Crea el viaje con los campos editados en la pantalla de revisión (que
 * abarcan generales + carga + descarga + tarifa de una sola vez), sube el
 * PDF original a Storage y lo deja registrado como adjunto tipo "cpe_pdf".
 */
export async function confirmarImportacionCpe(
  formData: FormData
): Promise<{ error?: string } | void> {
  const archivo = archivoDeFormData(formData);
  const datosJson = formData.get("datos");
  if (typeof datosJson !== "string") {
    return { error: "Faltan los datos del viaje." };
  }

  const valores = JSON.parse(datosJson) as ViajeDesdeCpeInput;
  const datos = viajeDesdeCpeSchema.parse(valores);

  const [viaje] = await db.insert(viajes).values(datos).returning({ id: viajes.id });
  await recalcularMerma(viaje.id);
  await recalcularFlete(viaje.id);
  await recalcularLiquidacionChofer(viaje.id);

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const rutaStorage = `viaje/${viaje.id}/${randomUUID()}-${archivo.name}`;
  await subirAdjunto(rutaStorage, buffer, archivo.type || "application/pdf");
  await db.insert(adjuntos).values({
    entidad: "viaje",
    entidad_id: viaje.id,
    tipo: "cpe_pdf",
    nombre_archivo: archivo.name,
    storage_path: rutaStorage,
  });

  redirect(`/viajes/${viaje.id}`);
}

// --- Creación rápida de entidades no encontradas por el matching ---

export async function crearClienteRapido(valores: ClienteInput): Promise<{ id: number }> {
  const datos = clienteSchema.parse(valores);
  const [fila] = await db.insert(clientes).values(datos).returning({ id: clientes.id });
  return fila;
}

export async function crearCamionRapido(valores: CamionInput): Promise<{ id: number }> {
  const datos = camionSchema.parse(valores);
  const [fila] = await db.insert(camiones).values(datos).returning({ id: camiones.id });
  return fila;
}

export async function crearChoferRapido(valores: ChoferInput): Promise<{ id: number }> {
  const datos = choferSchema.parse(valores);
  const [fila] = await db.insert(choferes).values(datos).returning({ id: choferes.id });
  return fila;
}

export async function crearLugarRapido(valores: LugarInput): Promise<{ id: number }> {
  // El quick-create no ofrece alias por variante de escritura, solo el nombre.
  const { alias, ...resto } = lugarSchema.parse(valores);
  void alias;
  const [fila] = await db.insert(lugares).values(resto).returning({ id: lugares.id });
  return fila;
}
