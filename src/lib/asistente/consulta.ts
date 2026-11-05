import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Lo que Félix nunca puede escribir en una consulta: cambiar de rol, leer archivos del servidor, etc. */
const PROHIBIDO =
  /\b(set_config|set|reset|role|session_authorization|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|copy|dblink|pg_sleep|pg_terminate_backend|pg_cancel_backend|do|call|grant|revoke|insert|update|delete|truncate|alter|drop|create|vacuum|analyze|listen|notify|lock)\b/i;

const MAX_FILAS = 200;
const MAX_CARACTERES = 30_000;

export type ResultadoConsulta = { ok: true; texto: string } | { ok: false; error: string };

/** Saca comentarios y literales de texto para revisar solo el SQL "de verdad". */
function sinTextoNiComentarios(consulta: string) {
  return consulta
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

/**
 * Corre una consulta que armó Félix. Tres barreras:
 * 1. Solo un SELECT (o WITH … SELECT), sin punto y coma ni palabras de la lista negra.
 * 2. Transacción READ ONLY con el rol asistente_lectura (migración 0016): solo
 *    ve las tablas de negocio y no puede escribir aunque lo intente.
 * 3. statement_timeout de 8 s y un tope de filas para no colgar la base.
 */
export async function consultarSoloLectura(consulta: string): Promise<ResultadoConsulta> {
  const texto = consulta.trim().replace(/;+\s*$/, "");
  const revisable = sinTextoNiComentarios(texto);
  if (!/^\s*(select|with)\b/i.test(revisable)) return { ok: false, error: "Solo se permiten consultas SELECT." };
  if (revisable.includes(";")) return { ok: false, error: "Una sola consulta por vez, sin punto y coma." };
  const prohibida = revisable.match(PROHIBIDO);
  if (prohibida) return { ok: false, error: `La consulta no puede usar "${prohibida[0]}".` };

  try {
    const filas = await db.transaction(
      async (tx) => {
        await tx.execute(sql`set local role asistente_lectura`);
        await tx.execute(sql`set local statement_timeout = '8s'`);
        return (await tx.execute(sql.raw(texto))) as unknown as Record<string, unknown>[];
      },
      { accessMode: "read only" }
    );
    const lista = [...filas];
    const recortadas = lista.slice(0, MAX_FILAS);
    let json = JSON.stringify(recortadas, (_k, v) => (v instanceof Date ? v.toISOString() : v));
    let aviso = lista.length > MAX_FILAS ? ` (se muestran ${MAX_FILAS} de ${lista.length}; usá LIMIT o agrupá)` : "";
    if (json.length > MAX_CARACTERES) {
      json = json.slice(0, MAX_CARACTERES);
      aviso += " (resultado recortado: pedí menos columnas o agrupá)";
    }
    return { ok: true, texto: `${lista.length} fila(s)${aviso}:\n${json}` };
  } catch (err) {
    // Drizzle envuelve el error de Postgres ("Failed query: …"); a Félix le
    // sirve el original ("column x does not exist") para corregir la consulta.
    const causa = err instanceof Error && err.cause instanceof Error ? err.cause : err;
    const mensaje = causa instanceof Error ? causa.message : String(causa);
    return { ok: false, error: mensaje.slice(0, 500) };
  }
}
