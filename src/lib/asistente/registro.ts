import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { asistenteRegistro } from "@/db/schema";

export type UsuarioFelix = { id: string; email: string };

/** Mensajes por hora por usuario: frena un loop o un uso raro antes de que se dispare el gasto. */
export const MAX_PREGUNTAS_POR_HORA = 100;

/**
 * Anota en asistente_registro. Nunca corta lo que se estaba haciendo: si
 * el registro falla (ej. la migración todavía no corrió) solo queda en el log.
 */
export async function registrar(
  usuario: UsuarioFelix,
  tipo: "pregunta" | "propuesta" | "confirmada" | "error",
  detalle: Record<string, unknown>
) {
  try {
    await db.insert(asistenteRegistro).values({ usuario_id: usuario.id, usuario_email: usuario.email, tipo, detalle });
  } catch (err) {
    console.error("Félix: no se pudo registrar", tipo, err);
  }
}

/** true si el usuario ya mandó demasiadas preguntas en la última hora. */
export async function superoElLimite(usuario: UsuarioFelix): Promise<boolean> {
  try {
    const [fila] = await db
      .select({ n: count() })
      .from(asistenteRegistro)
      .where(
        and(
          eq(asistenteRegistro.usuario_id, usuario.id),
          eq(asistenteRegistro.tipo, "pregunta"),
          gte(asistenteRegistro.creado_en, new Date(Date.now() - 3600_000))
        )
      );
    return (fila?.n ?? 0) >= MAX_PREGUNTAS_POR_HORA;
  } catch (err) {
    console.error("Félix: no se pudo revisar el límite", err);
    return false;
  }
}
