import { asc, desc } from "drizzle-orm";
import { viajes } from "@/db/schema";

export const COLUMNAS_ORDENABLES = {
  numero: viajes.numero,
  fecha_carga: viajes.fecha_carga,
  estado: viajes.estado,
  ctg: viajes.ctg,
} as const;

export type ColumnaOrdenable = keyof typeof COLUMNAS_ORDENABLES;

export function ordenViajes(sort?: string, dir?: string) {
  const columna =
    sort && sort in COLUMNAS_ORDENABLES
      ? COLUMNAS_ORDENABLES[sort as ColumnaOrdenable]
      : viajes.numero;
  return dir === "asc" ? asc(columna) : desc(columna);
}
