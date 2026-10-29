import Anthropic from "@anthropic-ai/sdk";
import { canvasParaClaude, LADO_LARGO_MAX_IA, renderizarPrimeraPagina } from "@/lib/cpe/render";
import { limpiarTextoIA } from "@/lib/ia/sanear";
import type { LineaLp, LpExtraido } from "./parser";

const numeroONull = { type: ["number", "null"] };
const textoONull = { type: ["string", "null"] };

const HERRAMIENTA_EXTRACCION = {
  name: "extraer_liquido_producto",
  description:
    "Extrae los datos de un Líquido Producto (comprobante cód. 060 de ARCA) con el que un cliente le liquida fletes de granos a una empresa de transporte.",
  input_schema: {
    type: "object" as const,
    properties: {
      numero: { ...textoONull, description: "Número del comprobante, ej. A0002-00007078." },
      fecha: { ...textoONull, description: "Fecha de emisión en formato yyyy-mm-dd." },
      emisor_cuit: { ...textoONull, description: "CUIT de quien emite el comprobante (encabezado), solo dígitos." },
      receptor_cuit: { ...textoONull, description: "CUIT del transportista al que se le liquida, solo dígitos." },
      cae: textoONull,
      lineas: {
        type: "array",
        description: "Una entrada por cada viaje (cada Carta de Porte) del detalle.",
        items: {
          type: "object",
          properties: {
            ctg: { type: "string", description: "Número de Carta de Porte / CTG de 11 dígitos." },
            kg: numeroONull,
            tarifa: { ...numeroONull, description: "Tarifa por tonelada." },
            km: numeroONull,
            total: { type: "number", description: "Importe del flete de esa línea, antes de descuentos." },
            comision: { type: "number", description: "Comisión por flete descontada en esa línea, en positivo (0 si no hay)." },
            otros_descuentos: { type: "number", description: "Otros descuentos de esa línea que no sean comisión, en positivo (0 si no hay)." },
          },
          required: ["ctg", "kg", "tarifa", "km", "total", "comision", "otros_descuentos"],
        },
      },
      neto_gravado: numeroONull,
      iva: numeroONull,
      total: numeroONull,
    },
    required: ["numero", "fecha", "emisor_cuit", "receptor_cuit", "cae", "lineas", "neto_gravado", "iva", "total"],
  },
};

/**
 * Fallback para un LP que el parser de texto no pudo leer (otro formato,
 * escaneado o foto). Devuelve null si no hay ANTHROPIC_API_KEY.
 */
export async function extraerLpConClaude(buffer: Buffer): Promise<LpExtraido | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const canvas = await renderizarPrimeraPagina(buffer, 2.5, LADO_LARGO_MAX_IA);
  const imagen = canvasParaClaude(canvas);

  const client = new Anthropic({ apiKey });
  const mensaje = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    tools: [HERRAMIENTA_EXTRACCION],
    tool_choice: { type: "tool", name: "extraer_liquido_producto" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imagen.media_type, data: imagen.data } },
          {
            type: "text",
            text: "Esta imagen es un Líquido Producto (cód. 060) con el que un cliente le liquida fletes de granos a un transportista. El detalle tiene una línea por viaje (propietario, producto, carta de porte o CTG, procedencia, destino, km, kg, tarifa, total) y, debajo de cada una, los descuentos de esa línea (por ejemplo \"Comisión por Flete\" en negativo). Completá una entrada de lineas por cada viaje, con sus descuentos en positivo. Los importes pueden venir con coma como separador de miles y punto decimal (1,054,800.00 = 1054800). Si un dato no está, poné null; no inventes valores.",
          },
        ],
      },
    ],
  });

  const uso = mensaje.content.find((b) => b.type === "tool_use");
  if (!uso || uso.type !== "tool_use") return null;
  const crudo = uso.input as LpExtraido;

  const digitos = (v: string | null) => limpiarTextoIA(v)?.replace(/[^0-9]/g, "") || null;
  const lineas: LineaLp[] = (crudo.lineas ?? [])
    .map((l) => ({ ...l, ctg: l.ctg.replace(/[^0-9]/g, ""), comision: l.comision ?? 0, otros_descuentos: l.otros_descuentos ?? 0 }))
    .filter((l) => l.ctg.length >= 10 && typeof l.total === "number");

  return {
    numero: limpiarTextoIA(crudo.numero),
    fecha: limpiarTextoIA(crudo.fecha),
    emisor_cuit: digitos(crudo.emisor_cuit),
    receptor_cuit: digitos(crudo.receptor_cuit),
    cae: limpiarTextoIA(crudo.cae),
    lineas,
    neto_gravado: crudo.neto_gravado,
    iva: crudo.iva,
    total: crudo.total,
  };
}
