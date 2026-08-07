import { ilike } from "drizzle-orm";
import { db } from "@/db";
import { lugares, lugaresAlias } from "@/db/schema";

/**
 * Busca un lugar por nombre exacto o por alias (sin mayúsculas ni
 * acentos, vía ILIKE). Usado tanto por el matching de CPE (Fase 10) como
 * por el importador de histórico (Fase 13) — ambos necesitan resolver
 * variantes reales de escritura ("Mojon de Fierro" / "Mijon de Fierro" /
 * "MOJON DE FIERRO") contra el mismo catálogo de lugares.
 */
export async function buscarLugarPorNombre(nombre: string | null): Promise<number | null> {
  if (!nombre) return null;
  const normalizado = nombre.trim();
  if (!normalizado) return null;

  const [porNombre] = await db
    .select({ id: lugares.id })
    .from(lugares)
    .where(ilike(lugares.nombre, normalizado));
  if (porNombre) return porNombre.id;

  const [porAlias] = await db
    .select({ id: lugaresAlias.lugar_id })
    .from(lugaresAlias)
    .where(ilike(lugaresAlias.alias, normalizado));
  return porAlias?.id ?? null;
}
