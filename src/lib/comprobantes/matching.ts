import { and, ilike } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes } from "@/db/schema";

/**
 * Busca un camión por patente exacta (ILIKE, sin distinguir mayúsculas) --
 * mismo criterio que el matching de CPE (lib/cpe/matching.ts), reutilizado
 * acá porque los tickets de surtidor suelen traer la patente del camión en
 * un renglón aparte al pie del comprobante.
 */
export async function buscarCamionPorPatente(patente: string | null): Promise<number | null> {
  if (!patente) return null;
  const normalizada = patente.trim();
  if (!normalizada) return null;

  const [fila] = await db
    .select({ id: camiones.id })
    .from(camiones)
    .where(ilike(camiones.dominio_tractor, normalizada));
  return fila?.id ?? null;
}

/**
 * Busca un chofer por nombre parcial: a diferencia del matching de CPE (que
 * tiene el CUIL exacto para comparar), los tickets de surtidor solo traen
 * un nombre en texto libre -- a veces apellido solo ("GUERRA"), a veces
 * nombre y apellido sin el segundo nombre ("portillo carlos" vs.
 * "PORTILLO CARLOS RUBEN" en el catálogo). Exige que TODAS las palabras
 * del nombre extraído aparezcan en el nombre completo del chofer, y
 * devuelve null si matchea a más de uno -- prefiere no completar el campo
 * antes que asignarle el gasto al chofer equivocado.
 */
export async function buscarChoferPorNombreParcial(nombre: string | null): Promise<number | null> {
  if (!nombre) return null;
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => p.length >= 3); // descarta iniciales/conectores sueltos ("de", "el", ...)
  if (palabras.length === 0) return null;

  const filas = await db
    .select({ id: choferes.id })
    .from(choferes)
    .where(and(...palabras.map((p) => ilike(choferes.nombre_completo, `%${p}%`))));

  return filas.length === 1 ? filas[0].id : null;
}
