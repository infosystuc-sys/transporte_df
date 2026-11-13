import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { preguntarAFelix, type AdjuntoFelix } from "@/lib/asistente/felix";
import { rolDeUsuario } from "@/lib/asistente/permisos";
import { MAX_PREGUNTAS_POR_HORA, registrar, superoElLimite } from "@/lib/asistente/registro";

export const dynamic = "force-dynamic";
// Félix puede encadenar varias consultas (y leer una foto) antes de responder.
export const maxDuration = 90;

const historialSchema = z
  .array(
    z.object({
      rol: z.enum(["usuario", "felix"]),
      texto: z.string().trim().min(1).max(4000),
    })
  )
  .min(1)
  .max(40);

const TIPOS_ADJUNTO = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;
const MAX_ADJUNTO = 4.4 * 1024 * 1024;

/**
 * Lee el pedido: JSON ({historial}) o, si viene una foto/PDF de un
 * comprobante, multipart con "historial" (JSON) y "archivo".
 */
async function leerPedido(request: NextRequest): Promise<{ historial: unknown; adjunto: AdjuntoFelix | null } | { error: string }> {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    const cuerpo = (await request.json().catch(() => null)) as { historial?: unknown } | null;
    return { historial: cuerpo?.historial, adjunto: null };
  }
  const form = await request.formData().catch(() => null);
  const historial = form?.get("historial");
  const archivo = form?.get("archivo");
  let adjunto: AdjuntoFelix | null = null;
  if (archivo instanceof File && archivo.size > 0) {
    const tipo = TIPOS_ADJUNTO.find((t) => t === archivo.type);
    if (!tipo) return { error: "Ese archivo no lo puedo leer. Mandá una foto (JPG o PNG) o un PDF." };
    if (archivo.size > MAX_ADJUNTO) return { error: "El archivo es muy pesado. Probá con una foto más chica." };
    adjunto = { media_type: tipo, data: Buffer.from(await archivo.arrayBuffer()).toString("base64") };
  }
  try {
    return { historial: typeof historial === "string" ? JSON.parse(historial) : null, adjunto };
  } catch {
    return { historial: null, adjunto };
  }
}

/** Chat con Félix. Solo para usuarios con sesión iniciada. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión para hablar con Félix." }, { status: 401 });

  const pedido = await leerPedido(request);
  if ("error" in pedido) return NextResponse.json({ error: pedido.error }, { status: 400 });
  const historial = historialSchema.safeParse(pedido.historial);
  if (!historial.success || historial.data.at(-1)?.rol !== "usuario") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const usuario = { id: user.id, email: user.email ?? "usuario sin email" };
  if (await superoElLimite(usuario)) {
    return NextResponse.json(
      { error: `Llegaste a ${MAX_PREGUNTAS_POR_HORA} mensajes en la última hora. Esperá un rato y seguimos.` },
      { status: 429 }
    );
  }

  try {
    const rol = await rolDeUsuario(user.id);
    const r = await preguntarAFelix(historial.data, usuario, rol, pedido.adjunto);
    await registrar(usuario, "pregunta", {
      texto: historial.data.at(-1)?.texto,
      adjunto: pedido.adjunto?.media_type ?? null,
      rol,
      ...(r.ok ? { consultas: r.consultas, propuestas: r.acciones.length } : { error: r.error }),
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    return NextResponse.json({ texto: r.texto, acciones: r.acciones });
  } catch (err) {
    console.error("Félix falló:", err);
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Félix está con muchas consultas. Probá de nuevo en un minuto." }, { status: 503 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Félix no se pudo conectar con la IA (clave inválida)." }, { status: 503 });
    }
    if (err instanceof Anthropic.BadRequestError && pedido.adjunto) {
      return NextResponse.json({ error: "No pude leer el archivo. Probá con otra foto." }, { status: 422 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "Félix no pudo responder ahora. Probá de nuevo en un rato." }, { status: 503 });
    }
    return NextResponse.json({ error: "Félix no pudo responder ahora. Probá de nuevo en un rato." }, { status: 500 });
  }
}
