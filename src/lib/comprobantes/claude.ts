import Anthropic from "@anthropic-ai/sdk";
import { canvasParaClaude, LADO_LARGO_MAX_IA, renderizarPrimeraPagina } from "@/lib/cpe/render";
import { limpiarCamposTexto } from "@/lib/ia/sanear";

const CAMPOS_TEXTO_COMPROBANTE = [
  "proveedor_nombre",
  "proveedor_cuit",
  "comprobante_nro",
  "patente",
  "chofer_nombre",
] as const;

export type ComprobanteExtraido = {
  fecha: string | null; // yyyy-mm-dd
  importe_total: number | null;
  litros: number | null;
  proveedor_nombre: string | null;
  proveedor_cuit: string | null;
  comprobante_nro: string | null;
  patente: string | null;
  /** Muchos tickets de surtidor imprimen el chofer al pie (ver prompt más abajo). */
  chofer_nombre: string | null;
  tipo_sugerido: "combustible" | "gasto" | "estadia" | "otro" | null;
  /**
   * Coincidencias contra los catálogos, calculadas en previsualizarComprobante
   * (no acá: esta función solo llama a Claude, no toca la base) a partir de
   * patente y chofer_nombre. null si no se encontró o no había dato para
   * buscar -- el formulario de Gasoil los usa para precargar camión/chofer,
   * siempre editables.
   */
  camion_id: number | null;
  chofer_id: number | null;
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
      chofer_nombre: { type: ["string", "null"] },
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
      "chofer_nombre",
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

  const canvas = await renderizarPrimeraPagina(buffer, 2.5, LADO_LARGO_MAX_IA);
  const imagen = canvasParaClaude(canvas);

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
            source: { type: "base64", media_type: imagen.media_type, data: imagen.data },
          },
          {
            type: "text",
            text: 'Esta es una foto o PDF de un comprobante de gasto de una empresa de transporte — puede ser un ticket de balanza, una factura de combustible, un remito, o similar. Extraé lo que encuentres. fecha en formato yyyy-mm-dd. Si un campo no aparece en el documento, poné null — no inventes valores. Para tipo_sugerido: "combustible" si es un ticket o factura de carga de combustible, "estadia" si es un comprobante de espera/estadía, "gasto" para cualquier otro gasto de viaje (peaje, balanza, lavado, reparación, viático, guía, etc.), "otro" si no podés determinarlo. Muchos tickets de surtidor imprimen el vehículo y el chofer en una línea al pie, aparte del resto del comprobante (por ejemplo "Vehiculo: ah499kv scania..Chofer: portillo carlos..Km: 0" o "VEH: CAMION PAT: AI362JX / CHOFER: GUERRA") — buscá esa línea con cuidado para patente y chofer_nombre. El chofer ahí a veces aparece solo con el apellido, y el papel térmico angosto a veces corta una palabra larga a la mitad y la sigue en el renglón de abajo (ej. "portillo carlo" + "lo carlos" en dos líneas es en realidad "portillo carlos" partido) — reconstruí el nombre completo en ese caso en vez de tomar el fragmento cortado literal. El "Km" de esa misma línea NO es el odómetro del camión, ignoralo.',
          },
        ],
      },
    ],
  });

  const usoHerramienta = mensaje.content.find((b) => b.type === "tool_use");
  if (!usoHerramienta || usoHerramienta.type !== "tool_use") return null;

  return {
    ...limpiarCamposTexto(usoHerramienta.input as ComprobanteExtraido, CAMPOS_TEXTO_COMPROBANTE),
    // Se completan después, en previsualizarComprobante: acá no hay acceso a la base.
    camion_id: null,
    chofer_id: null,
  };
}
