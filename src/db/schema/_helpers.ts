import { sql } from "drizzle-orm";
import { bigint, numeric, pgPolicy, timestamp } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/** Primary key estándar de la app: bigint identity (ver schema-primary-keys). */
export const idPk = () =>
  bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity();

/** Columna para referenciar un id bigint de otra tabla. */
export const fkBigint = (nombre: string) => bigint(nombre, { mode: "number" });

/** numeric(14,2) en modo string — nunca float, para columnas de dinero (ARS). */
export const dinero = (nombre: string) =>
  numeric(nombre, { precision: 14, scale: 2, mode: "string" });

/** numeric(12,2) en modo string, para columnas de peso (kg). */
export const pesoKg = (nombre: string) =>
  numeric(nombre, { precision: 12, scale: 2, mode: "string" });

/** numeric(6,3) en modo string, para porcentajes. */
export const porcentaje = (nombre: string) =>
  numeric(nombre, { precision: 6, scale: 3, mode: "string" });

/** numeric(10,2) en modo string, para cantidades (ej. litros de gasoil). */
export const cantidad = (nombre: string) =>
  numeric(nombre, { precision: 10, scale: 2, mode: "string" });

export const timestampTz = (nombre: string) => timestamp(nombre, { withTimezone: true });

/**
 * Política única de RLS pedida por el spec: acceso total para cualquier
 * usuario autenticado, sin distinción de filas. Se aplica igual en las 27
 * tablas de la app — no hay roles ni multi-tenant todavía.
 */
export const accesoTotalAutenticados = (tabla: string) =>
  pgPolicy(`${tabla}_acceso_total_autenticados`, {
    for: "all",
    to: authenticatedRole,
    using: sql`true`,
    withCheck: sql`true`,
  });
