import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { preguntarAFelix } from "@/lib/asistente/felix";

export const dynamic = "force-dynamic";
// Félix puede encadenar varias consultas antes de responder.
export const maxDuration = 60;

const pedidoSchema = z.object({
  historial: z
    .array(
      z.object({
        rol: z.enum(["usuario", "felix"]),
        texto: z.string().trim().min(1).max(4000),
      })
    )
    .min(1)
    .max(40),
});

/** Chat con Félix. Solo para usuarios con sesión iniciada. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión para hablar con Félix." }, { status: 401 });

  const parseado = pedidoSchema.safeParse(await request.json().catch(() => null));
  if (!parseado.success || parseado.data.historial.at(-1)?.rol !== "usuario") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const r = await preguntarAFelix(parseado.data.historial, user.email ?? "un usuario de la app");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    return NextResponse.json({ texto: r.texto });
  } catch (err) {
    console.error("Félix falló:", err);
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Félix está con muchas consultas. Probá de nuevo en un minuto." }, { status: 503 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Félix no se pudo conectar con la IA (clave inválida)." }, { status: 503 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "Félix no pudo responder ahora. Probá de nuevo en un rato." }, { status: 503 });
    }
    return NextResponse.json({ error: "Félix no pudo responder ahora. Probá de nuevo en un rato." }, { status: 500 });
  }
}
