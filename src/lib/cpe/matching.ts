import { eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, productos } from "@/db/schema";
import { buscarLugarPorNombre } from "@/lib/lugares/buscar";
import type { CpeExtraido } from "./parser";

export type Coincidencias = {
  titular_id: number | null;
  destinatario_id: number | null;
  pagador_id: number | null;
  chofer_id: number | null;
  camion_id: number | null;
  producto_id: number | null;
  origen_id: number | null;
  destino_id: number | null;
};

export type TipoEntidadFaltante = "cliente" | "chofer" | "camion" | "producto" | "lugar";

/** Campo del formulario de revisión que completa cada entidad al crearse. */
export type CampoViajeFaltante =
  | "cliente_id"
  | "pagador_id"
  | "destinatario_id"
  | "chofer_id"
  | "camion_id"
  | "producto_id"
  | "origen_id"
  | "destino_id";

/** Dato que la CPE menciona pero que todavía no existe en los catálogos. */
export type EntidadFaltante = {
  /** Identificador estable del rol dentro de la CPE (ej. "cliente_titular"). */
  clave: string;
  tipo: TipoEntidadFaltante;
  campo: CampoViajeFaltante;
  etiqueta: string;
  nombre: string;
  /** CUIT/CUIL cuando el tipo lo tiene; null en el resto. */
  documento: string | null;
};

/**
 * Cruza lo extraído de la CPE contra lo que encontró el matching y lista
 * lo que habría que dar de alta. Es pura a propósito (no toca la base):
 * corre en el server dentro de procesarCpe, pero el tipo lo consume la
 * pantalla de revisión para mostrar el panel de confirmación.
 *
 * Un dato solo cuenta como faltante si la CPE efectivamente lo trae: si el
 * PDF no lo tenía, no hay nada que crear y el campo queda para cargar a
 * mano como siempre.
 */
export function detectarFaltantes(cpe: CpeExtraido, c: Coincidencias): EntidadFaltante[] {
  const faltantes: EntidadFaltante[] = [];

  const agregar = (
    encontrado: number | null,
    clave: string,
    tipo: TipoEntidadFaltante,
    campo: CampoViajeFaltante,
    etiqueta: string,
    nombre: string | null,
    documento: string | null = null
  ) => {
    if (encontrado != null) return;
    const limpio = nombre?.trim();
    if (!limpio) return;
    faltantes.push({
      clave,
      tipo,
      campo,
      etiqueta,
      nombre: limpio,
      documento: documento?.trim() || null,
    });
  };

  agregar(c.titular_id, "cliente_titular", "cliente", "cliente_id", "Cliente (titular)", cpe.titular_nombre, cpe.titular_cuit);
  agregar(c.destinatario_id, "cliente_destinatario", "cliente", "destinatario_id", "Destinatario", cpe.destinatario_nombre, cpe.destinatario_cuit);
  agregar(c.pagador_id, "cliente_pagador", "cliente", "pagador_id", "Flete pagador", cpe.pagador_nombre, cpe.pagador_cuit);
  agregar(c.chofer_id, "chofer", "chofer", "chofer_id", "Chofer", cpe.chofer_nombre, cpe.chofer_cuil);
  agregar(c.producto_id, "producto", "producto", "producto_id", "Producto (especie)", cpe.producto_nombre);
  agregar(c.camion_id, "camion", "camion", "camion_id", "Camión", cpe.dominio_tractor);
  agregar(c.origen_id, "origen", "lugar", "origen_id", "Origen", cpe.origen_localidad);
  agregar(c.destino_id, "destino", "lugar", "destino_id", "Destino", cpe.destino_localidad);

  return faltantes;
}

function limpiarCuit(cuit: string) {
  return cuit.replace(/[^0-9]/g, "");
}

async function buscarClientePorCuit(cuit: string | null) {
  if (!cuit) return null;
  const [fila] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.cuit, limpiarCuit(cuit)));
  return fila?.id ?? null;
}

export async function buscarCoincidencias(cpe: CpeExtraido): Promise<Coincidencias> {
  const [titular_id, destinatario_id, pagador_id] = await Promise.all([
    buscarClientePorCuit(cpe.titular_cuit),
    buscarClientePorCuit(cpe.destinatario_cuit),
    buscarClientePorCuit(cpe.pagador_cuit),
  ]);

  const [chofer] = cpe.chofer_cuil
    ? await db.select({ id: choferes.id }).from(choferes).where(eq(choferes.cuil, limpiarCuit(cpe.chofer_cuil)))
    : [];

  const [camion] = cpe.dominio_tractor
    ? await db
        .select({ id: camiones.id })
        .from(camiones)
        .where(ilike(camiones.dominio_tractor, cpe.dominio_tractor))
    : [];

  const [producto] = cpe.producto_nombre
    ? await db.select({ id: productos.id }).from(productos).where(ilike(productos.nombre, cpe.producto_nombre))
    : [];

  const [origen_id, destino_id] = await Promise.all([
    buscarLugarPorNombre(cpe.origen_localidad),
    buscarLugarPorNombre(cpe.destino_localidad),
  ]);

  return {
    titular_id,
    destinatario_id,
    pagador_id,
    chofer_id: chofer?.id ?? null,
    camion_id: camion?.id ?? null,
    producto_id: producto?.id ?? null,
    origen_id,
    destino_id,
  };
}
