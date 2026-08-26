import { asc, desc } from "drizzle-orm";
import { viajes } from "@/db/schema";

export const COLUMNAS_ORDENABLES = {
  numero: viajes.numero,
  fecha_carga: viajes.fecha_carga,
  estado: viajes.estado,
  ctg: viajes.ctg,
  // Ordenar por el id alcanza para lo que se pide: que las filas de un
  // mismo camión/chofer queden consecutivas en vez de mezcladas por
  // fecha -- no hace falta el nombre para eso, y evitar el join acá
  // mantiene la consulta simple.
  camion: viajes.camion_id,
  chofer: viajes.chofer_id,
} as const;

export type ColumnaOrdenable = keyof typeof COLUMNAS_ORDENABLES;

export function ordenViajes(sort?: string, dir?: string) {
  const columna =
    sort && sort in COLUMNAS_ORDENABLES
      ? COLUMNAS_ORDENABLES[sort as ColumnaOrdenable]
      : viajes.numero;
  return dir === "asc" ? asc(columna) : desc(columna);
}
