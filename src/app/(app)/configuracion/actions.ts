"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  condicionesPago,
  estacionesServicio,
  lugares,
  lugaresAlias,
  mediosPago,
  productos,
  tiposAdicional,
  tiposContingencia,
  tiposGasto,
} from "@/db/schema";
import {
  condicionPagoSchema,
  estacionServicioSchema,
  medioPagoSchema,
  productoSchema,
  tipoAdicionalSchema,
  tipoContingenciaSchema,
  tipoGastoSchema,
  type CondicionPagoInput,
  type EstacionServicioInput,
  type MedioPagoInput,
  type ProductoInput,
  type TipoAdicionalInput,
  type TipoContingenciaInput,
  type TipoGastoInput,
} from "@/lib/schemas/catalogos";
import { lugarSchema, type LugarInput } from "@/lib/schemas/lugares";
import { esErrorDuplicado, esErrorReferenciado } from "@/lib/db/errores";

const RUTA = "/configuracion";
const MSG_DUPLICADO = "Ya existe un registro con ese nombre.";
const MSG_EN_USO = "No se puede eliminar: está en uso.";

// condiciones_pago
export async function crearCondicionPago(valores: CondicionPagoInput) {
  const datos = condicionPagoSchema.parse(valores);
  try {
    await db.insert(condicionesPago).values(datos);
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function actualizarCondicionPago(id: number, valores: CondicionPagoInput) {
  const datos = condicionPagoSchema.parse(valores);
  try {
    await db.update(condicionesPago).set(datos).where(eq(condicionesPago.id, id));
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function eliminarCondicionPago(id: number) {
  try {
    await db.delete(condicionesPago).where(eq(condicionesPago.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) return { error: MSG_EN_USO };
    throw error;
  }
  revalidatePath(RUTA);
}

// medios_pago
export async function crearMedioPago(valores: MedioPagoInput) {
  const datos = medioPagoSchema.parse(valores);
  try {
    await db.insert(mediosPago).values(datos);
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function actualizarMedioPago(id: number, valores: MedioPagoInput) {
  const datos = medioPagoSchema.parse(valores);
  try {
    await db.update(mediosPago).set(datos).where(eq(mediosPago.id, id));
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function eliminarMedioPago(id: number) {
  try {
    await db.delete(mediosPago).where(eq(mediosPago.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) return { error: MSG_EN_USO };
    throw error;
  }
  revalidatePath(RUTA);
}

// tipos_adicional
export async function crearTipoAdicional(valores: TipoAdicionalInput) {
  const datos = tipoAdicionalSchema.parse(valores);
  try {
    await db.insert(tiposAdicional).values(datos);
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function actualizarTipoAdicional(id: number, valores: TipoAdicionalInput) {
  const datos = tipoAdicionalSchema.parse(valores);
  try {
    await db.update(tiposAdicional).set(datos).where(eq(tiposAdicional.id, id));
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function eliminarTipoAdicional(id: number) {
  try {
    await db.delete(tiposAdicional).where(eq(tiposAdicional.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) return { error: MSG_EN_USO };
    throw error;
  }
  revalidatePath(RUTA);
}

// tipos_gasto
export async function crearTipoGasto(valores: TipoGastoInput) {
  const datos = tipoGastoSchema.parse(valores);
  try {
    await db.insert(tiposGasto).values(datos);
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function actualizarTipoGasto(id: number, valores: TipoGastoInput) {
  const datos = tipoGastoSchema.parse(valores);
  try {
    await db.update(tiposGasto).set(datos).where(eq(tiposGasto.id, id));
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function eliminarTipoGasto(id: number) {
  try {
    await db.delete(tiposGasto).where(eq(tiposGasto.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) return { error: MSG_EN_USO };
    throw error;
  }
  revalidatePath(RUTA);
}

// tipos_contingencia
export async function crearTipoContingencia(valores: TipoContingenciaInput) {
  const datos = tipoContingenciaSchema.parse(valores);
  try {
    await db.insert(tiposContingencia).values(datos);
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function actualizarTipoContingencia(id: number, valores: TipoContingenciaInput) {
  const datos = tipoContingenciaSchema.parse(valores);
  try {
    await db.update(tiposContingencia).set(datos).where(eq(tiposContingencia.id, id));
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function eliminarTipoContingencia(id: number) {
  try {
    await db.delete(tiposContingencia).where(eq(tiposContingencia.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) return { error: MSG_EN_USO };
    throw error;
  }
  revalidatePath(RUTA);
}

// estaciones_servicio
export async function crearEstacionServicio(valores: EstacionServicioInput) {
  const datos = estacionServicioSchema.parse(valores);
  try {
    await db.insert(estacionesServicio).values(datos);
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function actualizarEstacionServicio(id: number, valores: EstacionServicioInput) {
  const datos = estacionServicioSchema.parse(valores);
  try {
    await db.update(estacionesServicio).set(datos).where(eq(estacionesServicio.id, id));
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function eliminarEstacionServicio(id: number) {
  try {
    await db.delete(estacionesServicio).where(eq(estacionesServicio.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) return { error: MSG_EN_USO };
    throw error;
  }
  revalidatePath(RUTA);
}

// productos
export async function crearProducto(valores: ProductoInput) {
  const datos = productoSchema.parse(valores);
  try {
    await db.insert(productos).values(datos);
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function actualizarProducto(id: number, valores: ProductoInput) {
  const datos = productoSchema.parse(valores);
  try {
    await db.update(productos).set(datos).where(eq(productos.id, id));
  } catch (error) {
    if (esErrorDuplicado(error)) return { error: MSG_DUPLICADO };
    throw error;
  }
  revalidatePath(RUTA);
}
export async function eliminarProducto(id: number) {
  try {
    await db.delete(productos).where(eq(productos.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) return { error: MSG_EN_USO };
    throw error;
  }
  revalidatePath(RUTA);
}

// lugares (+ lugares_alias)
function parsearAlias(texto?: string) {
  if (!texto) return [];
  const vistos = new Set<string>();
  return texto
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => {
      if (!linea || vistos.has(linea)) return false;
      vistos.add(linea);
      return true;
    });
}

export async function crearLugar(valores: LugarInput) {
  const { alias, ...datos } = lugarSchema.parse(valores);
  await db.transaction(async (tx) => {
    const [lugar] = await tx.insert(lugares).values(datos).returning({ id: lugares.id });
    const nombresAlias = parsearAlias(alias);
    if (nombresAlias.length > 0) {
      await tx
        .insert(lugaresAlias)
        .values(nombresAlias.map((a) => ({ lugar_id: lugar.id, alias: a })));
    }
  });
  revalidatePath(RUTA);
}

export async function actualizarLugar(id: number, valores: LugarInput) {
  const { alias, ...datos } = lugarSchema.parse(valores);
  await db.transaction(async (tx) => {
    await tx.update(lugares).set(datos).where(eq(lugares.id, id));
    await tx.delete(lugaresAlias).where(eq(lugaresAlias.lugar_id, id));
    const nombresAlias = parsearAlias(alias);
    if (nombresAlias.length > 0) {
      await tx
        .insert(lugaresAlias)
        .values(nombresAlias.map((a) => ({ lugar_id: id, alias: a })));
    }
  });
  revalidatePath(RUTA);
}

export async function eliminarLugar(id: number) {
  try {
    await db.delete(lugares).where(eq(lugares.id, id));
  } catch (error) {
    if (esErrorReferenciado(error)) return { error: MSG_EN_USO };
    throw error;
  }
  revalidatePath(RUTA);
}
