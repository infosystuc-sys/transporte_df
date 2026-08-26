import Anthropic from "@anthropic-ai/sdk";
import { canvasParaClaude, LADO_LARGO_MAX_IA, renderizarPrimeraPagina } from "@/lib/cpe/render";

export type ComprobanteDescargaExtraido = {
  ctg: string | null;
  fecha_arribo: string | null; // yyyy-mm-dd
  fecha_descarga: string | null; // yyyy-mm-dd
  n_turno_descarga: string | null;
  bruto_destino_kg: number | null;
  tara_destino_kg: number | null;
  neto_destino_kg: number | null;
  humedad_pct: number | null;
};

const HERRAMIENTA_EXTRACCION = {
  name: "extraer_ticket_balanza",
  description:
    "Extrae los datos de un ticket de balanza o comprobante de descarga de una empresa de transporte de granos a partir de la imagen de su primera página.",
  input_schema: {
    type: "object" as const,
    properties: {
      ctg: { type: ["string", "null"] },
      fecha_arribo: { type: ["string", "null"] },
      fecha_descarga: { type: ["string", "null"] },
      n_turno_descarga: { type: ["string", "null"] },
      bruto_destino_kg: { type: ["number", "null"] },
      tara_destino_kg: { type: ["number", "null"] },
      neto_destino_kg: { type: ["number", "null"] },
      humedad_pct: { type: ["number", "null"] },
    },
    required: [
      "ctg",
      "fecha_arribo",
      "fecha_descarga",
      "n_turno_descarga",
      "bruto_destino_kg",
      "tara_destino_kg",
      "neto_destino_kg",
      "humedad_pct",
    ],
  },
};

/**
 * Extracción por IA del ticket de balanza / comprobante de descarga.
 * Separada de src/lib/comprobantes/claude.ts a propósito: ese extrae
 * comprobantes de gasto (plata), este extrae pesos y fechas de descarga —
 * campos y prompt distintos, mismo renderizarPrimeraPagina de base.
 * Devuelve null si no hay ANTHROPIC_API_KEY configurada.
 */
export async function extraerComprobanteDescarga(
  buffer: Buffer
): Promise<ComprobanteDescargaExtraido | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const canvas = await renderizarPrimeraPagina(buffer, 2.5, LADO_LARGO_MAX_IA);
  const imagen = canvasParaClaude(canvas);

  const client = new Anthropic({ apiKey });
  const mensaje = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    tools: [HERRAMIENTA_EXTRACCION],
    tool_choice: { type: "tool", name: "extraer_ticket_balanza" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: imagen.media_type, data: imagen.data },
          },
          {
            type: "text",
            text: 'Esta es una foto o PDF de un ticket de balanza o comprobante de descarga de un camión con granos en destino (puede ser una nota de recepción de una empresa como Cargill, Vicentin, ACA, etc., no necesariamente un formulario oficial de ARCA). Extraé el CTG (Código de Trazabilidad de Granos, un número largo que suele figurar como "CTG", "Carta de Porte" o similar — es el mismo número que identifica el viaje de origen a destino), fecha de arribo, fecha de descarga, número de turno, peso bruto, tara y peso neto (todos los pesos en KILOGRAMOS — si el ticket los muestra en toneladas, convertilos multiplicando por 1000) y el porcentaje de humedad si figura. Fechas en formato yyyy-mm-dd. Si un campo no aparece en el documento, poné null — no inventes valores.',
          },
        ],
      },
    ],
  });

  const usoHerramienta = mensaje.content.find((b) => b.type === "tool_use");
  if (!usoHerramienta || usoHerramienta.type !== "tool_use") return null;

  return usoHerramienta.input as ComprobanteDescargaExtraido;
}
