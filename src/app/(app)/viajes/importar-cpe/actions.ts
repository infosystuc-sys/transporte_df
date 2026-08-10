"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { adjuntos, camiones, choferes, clientes, lugares, productos, viajes } from "@/db/schema";
import { clienteSchema, type ClienteInput } from "@/lib/schemas/clientes";
import { camionSchema, choferSchema, type CamionInput, type ChoferInput } from "@/lib/schemas/flota";
import { lugarSchema, type LugarInput } from "@/lib/schemas/lugares";
import { productoSchema, type ProductoInput } from "@/lib/schemas/catalogos";
import {
  crearFaltantesSchema,
  viajeDesdeCpeSchema,
  type CrearFaltantesInput,
  type ViajeDesdeCpeInput,
} from "@/lib/schemas/cpe-importacion";
import { procesarCpe, type ResultadoImportacionCpe } from "@/lib/cpe/importar";
import { buscarLugarPorNombre } from "@/lib/lugares/buscar";
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

export async function crearProductoRapido(valores: ProductoInput): Promise<{ id: number }> {
  const datos = productoSchema.parse(valores);
  const [fila] = await db.insert(productos).values(datos).returning({ id: productos.id });
  return fila;
}

// --- Alta masiva de lo que la CPE menciona y todavía no existe ---

function limpiarDocumento(doc: string) {
  return doc.replace(/[^0-9]/g, "");
}

/**
 * Vuelve a buscar la entidad justo antes de crearla. Es lo que hace segura
 * esta acción frente a un doble click o a que alguien haya dado de alta lo
 * mismo desde otra pantalla mientras se revisaba la CPE: si ya apareció,
 * se reutiliza en vez de duplicar. Además productos.nombre es UNIQUE, así
 * que sin este chequeo un reintento tiraría error de base.
 */
async function resolverOCrear(f: {
  tipo: "cliente" | "chofer" | "camion" | "producto" | "lugar";
  nombre: string;
  documento: string | null;
}): Promise<number> {
  const nombre = f.nombre.trim();
  const doc = f.documento ? limpiarDocumento(f.documento) : null;

  switch (f.tipo) {
    case "cliente": {
      const existente = doc
        ? await db.select({ id: clientes.id }).from(clientes).where(eq(clientes.cuit, doc))
        : await db.select({ id: clientes.id }).from(clientes).where(ilike(clientes.razon_social, nombre));
      if (existente[0]) return existente[0].id;
      const { id } = await crearClienteRapido({ razon_social: nombre, cuit: doc ?? "" });
      return id;
    }
    case "chofer": {
      const existente = doc
        ? await db.select({ id: choferes.id }).from(choferes).where(eq(choferes.cuil, doc))
        : await db.select({ id: choferes.id }).from(choferes).where(ilike(choferes.nombre_completo, nombre));
      if (existente[0]) return existente[0].id;
      const { id } = await crearChoferRapido({ nombre_completo: nombre, cuil: doc ?? "" });
      return id;
    }
    case "camion": {
      const [existente] = await db
        .select({ id: camiones.id })
        .from(camiones)
        .where(ilike(camiones.dominio_tractor, nombre));
      if (existente) return existente.id;
      const { id } = await crearCamionRapido({ dominio_tractor: nombre });
      return id;
    }
    case "producto": {
      const [existente] = await db
        .select({ id: productos.id })
        .from(productos)
        .where(ilike(productos.nombre, nombre));
      if (existente) return existente.id;
      // La CPE Automotor de ARCA transporta granos, así que la especie
      // nueva nace como "grano". Si fuera otra cosa se corrige después
      // desde Configuración → Productos.
      const { id } = await crearProductoRapido({ nombre, tipo: "grano" });
      return id;
    }
    case "lugar": {
      const existente = await buscarLugarPorNombre(nombre);
      if (existente != null) return existente;
      const { id } = await crearLugarRapido({ nombre });
      return id;
    }
  }
}

/**
 * Da de alta de una sola vez todo lo que la CPE menciona y no existía,
 * y devuelve el id resultante por rol (clave) para que la pantalla de
 * revisión complete los campos del formulario.
 *
 * Deduplica por tipo + documento (o nombre): en una CPE es común que el
 * titular, el destinatario y el flete pagador sean la misma empresa, y
 * clientes.cuit no tiene constraint único — sin esto se crearían tres
 * fichas idénticas del mismo cliente.
 */
export async function crearEntidadesFaltantes(
  valores: CrearFaltantesInput
): Promise<{ creadas?: Record<string, number>; error?: string }> {
  const parseado = crearFaltantesSchema.safeParse(valores);
  if (!parseado.success) {
    return { error: parseado.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const creadas: Record<string, number> = {};
  const cache = new Map<string, number>();

  try {
    for (const f of parseado.data.faltantes) {
      const huella = `${f.tipo}:${(f.documento ? limpiarDocumento(f.documento) : f.nombre).toLowerCase()}`;
      const yaResuelto = cache.get(huella);
      const id = yaResuelto ?? (await resolverOCrear(f));
      cache.set(huella, id);
      creadas[f.clave] = id;
    }
  } catch {
    return { error: "No se pudieron dar de alta los registros. Revisá los datos e intentá de nuevo." };
  }

  revalidatePath("/viajes/importar-cpe");
  return { creadas };
}
