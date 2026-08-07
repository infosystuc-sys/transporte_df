"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes } from "@/db/schema";
import { clienteSchema, type ClienteInput } from "@/lib/schemas/clientes";
import { esErrorReferenciado } from "@/lib/db/errores";

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
