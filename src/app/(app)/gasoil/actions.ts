"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { camiones, cargasGasoil, estacionesServicio } from "@/db/schema";
import { cargaGasoilSchema, type CargaGasoilInput } from "@/lib/schemas/gasoil";
import { registrarMovimientoAutomatico } from "@/lib/cuenta-corriente/movimientos";

const RUTA = "/gasoil";

export async function crearCargaGasoil(valores: CargaGasoilInput): Promise<{ error?: string } | void> {
  const datos = cargaGasoilSchema.parse(valores);
  await db.insert(cargasGasoil).values(datos);

  const [camion] = await db.select().from(camiones).where(eq(camiones.id, datos.camion_id));
  if (camion && (camion.odometro_actual == null || datos.odometro > camion.odometro_actual)) {
    await db.update(camiones).set({ odometro_actual: datos.odometro }).where(eq(camiones.id, datos.camion_id));
  }

  if (datos.modalidad === "pagado_por_chofer" && datos.chofer_id) {
    const [estacion] = datos.estacion_id
      ? await db.select().from(estacionesServicio).where(eq(estacionesServicio.id, datos.estacion_id))
      : [];
    await registrarMovimientoAutomatico({
      chofer_id: datos.chofer_id,
      tipo: "gasto_rendido",
      importe: datos.importe,
      viaje_id: datos.viaje_id,
      descripcion: `Gasoil${estacion ? ` en ${estacion.nombre}` : ""} (${datos.litros} L)`,
    });
  }

  revalidatePath(RUTA);
}

export async function actualizarCargaGasoil(
  id: number,
  valores: CargaGasoilInput
): Promise<{ error?: string } | void> {
  const datos = cargaGasoilSchema.parse(valores);
  await db.update(cargasGasoil).set(datos).where(eq(cargasGasoil.id, id));

  const [camion] = await db.select().from(camiones).where(eq(camiones.id, datos.camion_id));
  if (camion && (camion.odometro_actual == null || datos.odometro > camion.odometro_actual)) {
    await db.update(camiones).set({ odometro_actual: datos.odometro }).where(eq(camiones.id, datos.camion_id));
  }

  revalidatePath(RUTA);
}

export async function eliminarCargaGasoil(id: number): Promise<{ error?: string } | void> {
  await db.delete(cargasGasoil).where(eq(cargasGasoil.id, id));
  revalidatePath(RUTA);
}
