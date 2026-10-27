"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes } from "@/db/schema";
import { clienteSchema, comisionClienteSchema, type ClienteInput } from "@/lib/schemas/clientes";
import { esErrorReferenciado } from "@/lib/db/errores";
import { cuitLimpioIgual } from "@/lib/cpe/matching";

const RUTA = "/clientes";

export async function crearCliente(valores: ClienteInput) {
  const datos = clienteSchema.parse(valores);
  await db.insert(clientes).values(datos);
  revalidatePath(RUTA);
}

export async function actualizarCliente(id: number, valores: ClienteInput) {
  const datos = clienteSchema.parse(valores);
  await db.update(clientes).set(datos).where(eq(clientes.id, id));
  revalidatePath(RUTA);
}

export async function eliminarCliente(id: number) {
  try {
    await db.delete(clientes).where(eq(clientes.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) {
      return { error: "No se puede eliminar: tiene lugares, tarifas o viajes asociados." };
    }
    throw error;
  }
  revalidatePath(RUTA);
}

/** Guarda solo el % de comisión, desde la solapa Comisiones (vacío = sin comisión). */
export async function guardarComisionCliente(id: number, comision: string) {
  const parseado = comisionClienteSchema.shape.comision.safeParse(comision);
  if (!parseado.success) return { error: parseado.error.issues[0]?.message ?? "Porcentaje inválido." };
  await db
    .update(clientes)
    .set({ comision_intermediario_pct_default: parseado.data ?? null })
    .where(eq(clientes.id, id));
  revalidatePath(RUTA);
}

/**
 * Alta rápida desde la solapa Comisiones. Si ya hay un cliente con ese
 * CUIT no se crea otro: el importador de CPE lo busca por CUIT, así que un
 * duplicado haría que la comisión cargada acá nunca se use.
 */
export async function crearClienteConComision(valores: {
  razon_social: string;
  cuit: string;
  comision: string;
}) {
  const parseado = comisionClienteSchema.safeParse(valores);
  if (!parseado.success) return { error: parseado.error.issues[0]?.message ?? "Datos inválidos." };
  const { razon_social, cuit, comision } = parseado.data;

  const [existente] = await db
    .select({ razon_social: clientes.razon_social })
    .from(clientes)
    .where(cuitLimpioIgual(clientes.cuit, cuit));
  if (existente) {
    return { error: `Ya existe un cliente con ese CUIT: ${existente.razon_social}. Cargale el % en la tabla.` };
  }

  await db.insert(clientes).values({ razon_social, cuit, comision_intermediario_pct_default: comision ?? null });
  revalidatePath(RUTA);
}
