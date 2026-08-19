import Anthropic from "@anthropic-ai/sdk";
import { renderizarPrimeraPagina } from "@/lib/cpe/render";

export type ComprobanteExtraido = {
  fecha: string | null; // yyyy-mm-dd
  importe_total: number | null;
  litros: number | null;
  proveedor_nombre: string | null;
  proveedor_cuit: string | null;
  comprobante_nro: string | null;
  patente: string | null;
  tipo_sugerido: "combustible" | "gasto" | "estadia" | "otro" | null;
};

const HERRAMIENTA_EXTRACCION = {
  name: "extraer_comprobante",
  description:
    "Extrae los datos de un comprobante de gasto de una empresa de transporte (ticket de balanza, factura de combustible, remito o similar) a partir de la imagen de su primera página.",
  input_schema: {
    type: "object" as const,
    properties: {
      fecha: { type: ["string", "null"] },
      importe_total: { type: ["number", "null"] },
      litros: { type: ["number", "null"] },
      proveedor_nombre: { type: ["string", "null"] },
      proveedor_cuit: { type: ["string", "null"] },
      comprobante_nro: { type: ["string", "null"] },
      patente: { type: ["string", "null"] },
      tipo_sugerido: {
        type: ["string", "null"],
        enum: ["combustible", "gasto", "estadia", "otro", null],
      },
    },
    required: [
      "fecha",
      "importe_total",
      "litros",
      "proveedor_nombre",
      "proveedor_cuit",
      "comprobante_nro",
      "patente",
      "tipo_sugerido",
    ],
  },
};

/**
 * Extracción por IA de comprobantes de gasto (combustible, peajes, balanza,
 * estadía, etc). Separada de src/lib/cpe/claude.ts a propósito: es un
 * documento distinto, con su propio tool_use y su propio prompt — lo único
 * que comparte con la importación de CPE es renderizarPrimeraPagina.
 * Devuelve null si no hay ANTHROPIC_API_KEY configurada.
 */
export async function extraerComprobante(buffer: Buffer): Promise<ComprobanteExtraido | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const canvas = await renderizarPrimeraPagina(buffer, 2.5);
  const png = canvas.toBuffer("image/png");

  const client = new Anthropic({ apiKey });
  const mensaje = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    tools: [HERRAMIENTA_EXTRACCION],
    tool_choice: { type: "tool", name: "extraer_comprobante" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: png.toString("base64") },
          },
          {
            type: "text",
            text: 'Esta es una foto o PDF de un comprobante de gasto de una empresa de transporte — puede ser un ticket de balanza, una factura de combustible, un remito, o similar. Extraé lo que encuentres. fecha en formato yyyy-mm-dd. Si un campo no aparece en el documento, poné null — no inventes valores. Para tipo_sugerido: "combustible" si es un ticket o factura de carga de combustible, "estadia" si es un comprobante de espera/estadía, "gasto" para cualquier otro gasto de viaje (peaje, balanza, lavado, reparación, viático, guía, etc.), "otro" si no podés determinarlo.',
          },
        ],
      },
    ],
  });

  const usoHerramienta = mensaje.content.find((b) => b.type === "tool_use");
  if (!usoHerramienta || usoHerramienta.type !== "tool_use") return null;

  return usoHerramienta.input as ComprobanteExtraido;
}
