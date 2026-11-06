import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { transcribirAudio } from "@/lib/asistente/transcripcion";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024; // un audio de 1 minuto pesa ~0,5 MB

let vocabulario: { texto: string; hasta: number } | null = null;

/**
 * Nombres propios que el transcriptor tiene que escribir bien (choferes,
 * clientes, patentes). Se le pasan como contexto: es lo que más errores
 * evita en una pregunta como "¿cuánto lleva ganado Portillo?".
 */
async function vocabularioApp() {
  if (vocabulario && vocabulario.hasta > Date.now()) return vocabulario.texto;
  const [filasChoferes, filasClientes, filasCamiones] = await Promise.all([
    db.select({ n: choferes.nombre_completo }).from(choferes).where(eq(choferes.activo, true)).orderBy(asc(choferes.nombre_completo)),
    db.select({ n: clientes.razon_social }).from(clientes).where(eq(clientes.activo, true)).orderBy(asc(clientes.razon_social)),
    db.select({ n: camiones.dominio_tractor }).from(camiones).where(eq(camiones.activo, true)),
  ]);
  const texto = [
    "Pregunta al asistente de una empresa de transporte de granos de Argentina (fletes, cartas de porte CTG, líquido producto, gasoil, adelantos, liquidaciones).",
    `Choferes: ${filasChoferes.map((f) => f.n).join(", ")}.`,
    `Clientes: ${filasClientes.map((f) => f.n).join(", ")}.`,
    `Patentes: ${filasCamiones.map((f) => f.n).join(", ")}.`,
  ]
    .join(" ")
    .slice(0, 2000);
  vocabulario = { texto, hasta: Date.now() + 10 * 60 * 1000 };
  return texto;
}

/** Recibe una nota de voz del chat de Félix y devuelve el texto. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión para hablar con Félix." }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "No llegó el audio." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "El audio es muy largo. Probá con uno más corto." }, { status: 413 });

  let contexto: string | null = null;
  try {
    contexto = await vocabularioApp();
  } catch (err) {
    // Sin la lista de nombres transcribe igual, solo que con menos ayuda.
    console.error("transcribir: no se pudo armar el vocabulario:", err);
  }

  const r = await transcribirAudio(audio, contexto);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ texto: r.texto });
}
