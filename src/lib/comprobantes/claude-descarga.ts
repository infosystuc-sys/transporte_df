import Anthropic from "@anthropic-ai/sdk";
import { canvasParaClaude, LADO_LARGO_MAX_IA, renderizarPrimeraPagina } from "@/lib/cpe/render";
import { limpiarCamposTexto } from "@/lib/ia/sanear";

const CAMPOS_TEXTO_DESCARGA = ["ctg", "n_turno_descarga"] as const;
const CAMPOS_NUMERO_DESCARGA = ["bruto_destino_kg", "tara_destino_kg", "neto_destino_kg", "humedad_pct"] as const;

export type ComprobanteDescargaExtraido = {
  ctg: string | null;
  fecha_arribo: string | null; // yyyy-mm-dd
  fecha_descarga: string | null; // yyyy-mm-dd
  n_turno_descarga: string | null;
  bruto_destino_kg: number | null;
  tara_destino_kg: number | null;
  neto_destino_kg: number | null;
  humedad_pct: number | null;
  /** Ver claude.ts (CPE) -- mismo mecanismo, nombres de campos de este tipo. */
  campos_dudosos: string[];
};

const NOMBRES_CAMPOS_VALIDOS_DESCARGA = new Set<string>([
  ...CAMPOS_TEXTO_DESCARGA,
  ...CAMPOS_NUMERO_DESCARGA,
]);

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
      campos_dudosos: {
        type: "array",
        items: { type: "string", enum: [...CAMPOS_TEXTO_DESCARGA, ...CAMPOS_NUMERO_DESCARGA] },
        description:
          "Nombres de los campos de arriba que pudiste completar pero con baja confianza (texto borroso, poco iluminado, o que tuviste que inferir en vez de leer directamente). No incluyas acá los que ya pusiste en null.",
      },
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
      "campos_dudosos",
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
            text: 'Esta es una foto o PDF de un ticket de balanza o comprobante de descarga de un camión con granos en destino (puede ser una nota de recepción de una empresa como Cargill, Vicentin, ACA, etc., no necesariamente un formulario oficial de ARCA). Extraé el CTG (Código de Trazabilidad de Granos, un número largo que suele figurar como "CTG", "Carta de Porte" o similar — es el mismo número que identifica el viaje de origen a destino), fecha de arribo, fecha de descarga, número de turno, peso bruto, tara y peso neto (todos los pesos en KILOGRAMOS — si el ticket los muestra en toneladas, convertilos multiplicando por 1000) y el porcentaje de humedad si figura. Fechas en formato yyyy-mm-dd. Si un campo no aparece en el documento, poné null — no inventes valores. La imagen puede venir con calidad degradada (foto de celular comprimida, poca luz, texto chico) — cuando completes un campo pero no estés del todo seguro de haberlo leído bien, agregá el nombre de ese campo a campos_dudosos en vez de fingir certeza. Es preferible marcar de más que de menos.',
          },
        ],
      },
    ],
  });

  const usoHerramienta = mensaje.content.find((b) => b.type === "tool_use");
  if (!usoHerramienta || usoHerramienta.type !== "tool_use") return null;

  // Ver sanear.ts: Claude a veces contesta "unknown"/"n/a" en vez de null.
  const extraido = limpiarCamposTexto(
    usoHerramienta.input as ComprobanteDescargaExtraido,
    CAMPOS_TEXTO_DESCARGA
  );

  extraido.campos_dudosos = (extraido.campos_dudosos ?? []).filter(
    (campo) =>
      NOMBRES_CAMPOS_VALIDOS_DESCARGA.has(campo) &&
      extraido[campo as keyof ComprobanteDescargaExtraido] != null
  );

  return extraido;
}
