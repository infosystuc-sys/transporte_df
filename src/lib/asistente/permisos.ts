import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";

/**
 * Qué puede ver y hacer cada usuario con Félix.
 * - admin (dueños, David, Silvana): todo.
 * - empleado (ej. Sebastián): lo operativo (viajes, kilos, choferes,
 *   camiones, gasoil, vencimientos) sin la plata del negocio: tarifas,
 *   fletes, facturación, cobros, LP, liquidaciones, adelantos ni lo que
 *   cobra cada chofer. Puede cargar gasoil, cargas y descargas, pero no
 *   cambiar tarifas ni borrar viajes.
 * El rol sale de usuarios.rol; si el usuario no tiene fila, es admin
 * (así venían funcionando todos hasta ahora).
 */
export type RolFelix = "admin" | "empleado";

export async function rolDeUsuario(usuarioId: string): Promise<RolFelix> {
  const [fila] = await db.select({ rol: usuarios.rol }).from(usuarios).where(eq(usuarios.id, usuarioId));
  return fila?.rol === "empleado" ? "empleado" : "admin";
}

/** Rol de base de datos con el que corre cada consulta de Félix. */
export const ROL_BASE: Record<RolFelix, string> = {
  admin: "asistente_lectura",
  empleado: "asistente_empleado",
};

/**
 * Columnas que ve un empleado: "*" = la tabla entera. Tiene que coincidir
 * con los GRANT de drizzle/0018_asistente_empleado.sql, que es lo que de
 * verdad lo frena (esto solo arma la descripción que lee Félix).
 */
export const COLUMNAS_EMPLEADO: Record<string, "*" | readonly string[]> = {
  viajes: [
    "id", "numero", "estado", "tipo_carga", "tiene_cpe", "cpe_nro", "ctg", "cpe_fecha_emision", "ctg_vencimiento",
    "campania", "remito_nro", "declaracion_calidad", "cliente_id", "camion_id", "chofer_id", "dominio_tractor",
    "dominio_acoplado", "producto_id", "origen_id", "destino_id", "km", "fecha_carga", "fecha_partida",
    "fecha_arribo", "fecha_descarga", "n_turno_descarga", "bruto_origen", "tara_origen", "neto_origen",
    "bruto_destino", "tara_destino", "neto_destino", "merma_kg", "merma_pct", "tolerancia_pct_aplicada",
    "merma_excede_tolerancia", "viaje_relacionado_id", "observaciones", "creado_en", "actualizado_en",
    "titular_nombre", "titular_cuit", "destinatario_nombre", "destinatario_cuit", "viaje_reemplaza_a_id",
    "humedad_pct", "origen_estimado",
  ],
  clientes: [
    "id", "razon_social", "nombre_fantasia", "cuit", "direccion", "localidad", "provincia", "telefono", "email",
    "contacto", "es_dador_carga", "es_pagador_flete", "activo",
  ],
  choferes: [
    "id", "nombre_completo", "cuil", "dni", "telefono", "email", "direccion", "localidad", "licencia_nro",
    "licencia_vto", "linti_vto", "camion_habitual_id", "observaciones", "activo",
  ],
  camiones: "*",
  productos: ["id", "nombre", "tipo", "activo"],
  lugares: "*",
  lugares_alias: "*",
  estaciones_servicio: "*",
  cargas_gasoil: "*",
  viaje_gastos: "*",
  viaje_contingencias: "*",
  tipos_gasto: "*",
  tipos_contingencia: "*",
};

export const ACCIONES_POR_ROL: Record<RolFelix, readonly string[]> = {
  admin: ["cargar_gasoil", "cargar_viaje", "descargar_viaje", "cambiar_tarifa", "eliminar_viaje"],
  empleado: ["cargar_gasoil", "cargar_viaje", "descargar_viaje"],
};

export const NOTA_ROL: Record<RolFelix, string> = {
  admin: "",
  empleado:
    "Quien te escribe es un empleado: no tiene acceso a tarifas, fletes, facturación, cobros, LP, liquidaciones, adelantos ni a lo que cobra cada chofer. Si te pregunta algo de eso, decile que eso lo ven David o Silvana. Puede cargar gasoil, cargas y descargas, pero no cambiar tarifas ni borrar viajes. Las tablas y columnas de abajo son las únicas que ves: nombrá siempre las columnas (no uses SELECT *).",
};
