const MODELO = "gpt-4o-transcribe";

export type ResultadoTranscripcion = { ok: true; texto: string } | { ok: false; error: string; status: number };

/**
 * Pasa una nota de voz a texto con OpenAI (Claude no recibe audio).
 * `vocabulario` lleva los nombres propios de la app (choferes, clientes,
 * patentes) para que los escriba bien. OPENAI_BASE_URL solo existe para
 * las pruebas contra un servidor simulado.
 */
export async function transcribirAudio(audio: File, vocabulario: string | null): Promise<ResultadoTranscripcion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, status: 503, error: "Los audios todavía no están configurados (falta la clave de transcripción)." };

  const pedido = new FormData();
  pedido.set("file", audio, audio.name || "nota-de-voz.webm");
  pedido.set("model", MODELO);
  pedido.set("language", "es");
  pedido.set("response_format", "json");
  if (vocabulario) pedido.set("prompt", vocabulario);

  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  try {
    const res = await fetch(`${base}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: pedido,
    });
    if (!res.ok) {
      console.error("transcribir: OpenAI respondió", res.status, (await res.text()).slice(0, 500));
      const error =
        res.status === 401
          ? "La clave de transcripción no es válida."
          : res.status === 429
            ? "El servicio de audio está saturado o sin crédito. Probá de nuevo en un rato."
            : "No se pudo pasar el audio a texto. Probá de nuevo o escribilo.";
      return { ok: false, status: 502, error };
    }
    const datos = (await res.json()) as { text?: string };
    const texto = datos.text?.trim();
    if (!texto) return { ok: false, status: 422, error: "No se entendió el audio. Probá de nuevo hablando más cerca." };
    return { ok: true, texto };
  } catch (err) {
    console.error("transcribir falló:", err);
    return { ok: false, status: 502, error: "No se pudo pasar el audio a texto. Probá de nuevo o escribilo." };
  }
}
