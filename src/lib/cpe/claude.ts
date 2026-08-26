import Anthropic from "@anthropic-ai/sdk";
import { canvasParaClaude, LADO_LARGO_MAX_IA, renderizarPrimeraPagina } from "./render";
import type { CpeExtraido } from "./parser";

const CAMPOS_TEXTO = [
  "ctg",
  "cpe_nro",
  "campania",
  "titular_cuit",
  "titular_nombre",
  "destinatario_cuit",
  "destinatario_nombre",
  "pagador_cuit",
  "pagador_nombre",
  "chofer_cuil",
  "chofer_nombre",
  "producto_nombre",
  "origen_localidad",
  "origen_provincia",
  "destino_n_planta",
  "destino_direccion",
  "destino_localidad",
  "destino_provincia",
  "dominio_tractor",
  "dominio_acoplado",
  "n_turno_descarga",
] as const;

const CAMPOS_NUMERO = [
  "bruto_origen_kg",
  "tara_origen_kg",
  "neto_origen_kg",
  "km",
  "valor_tarifa",
  "bruto_destino_kg",
  "tara_destino_kg",
  "neto_destino_kg",
] as const;

// Fechas en ISO: cpe_fecha_emision es yyyy-mm-dd; el resto yyyy-mm-ddTHH:mm:ss.
const CAMPOS_FECHA = [
  "cpe_fecha_emision",
  "ctg_vencimiento",
  "fecha_partida",
  "fecha_arribo",
  "fecha_descarga",
] as const;

function propiedadesTexto(campos: readonly string[]) {
  return Object.fromEntries(campos.map((c) => [c, { type: ["string", "null"] }]));
}

const HERRAMIENTA_EXTRACCION = {
  name: "extraer_cpe",
  description: "Extrae los datos de una Carta de Porte Electrónica (CPE) de ARCA a partir de la imagen de su primera página.",
  input_schema: {
    type: "object" as const,
    properties: {
      ...propiedadesTexto(CAMPOS_TEXTO),
      ...propiedadesTexto(CAMPOS_FECHA),
      declaracion_calidad: { type: ["string", "null"], enum: ["conforme", "condicional", null] },
      ...Object.fromEntries(CAMPOS_NUMERO.map((c) => [c, { type: ["number", "null"] }])),
    },
    required: [...CAMPOS_TEXTO, ...CAMPOS_FECHA, ...CAMPOS_NUMERO, "declaracion_calidad"],
  },
};

/**
 * Fallback para CPEs escaneadas (sin capa de texto): renderiza la primera
 * página a imagen y le pide a Claude que complete el mismo shape que arma
 * el parser de texto (spec 5, paso 3). Devuelve null si no hay
 * ANTHROPIC_API_KEY configurada — la pantalla de revisión ya sabe mostrar
 * "cargalo a mano" en ese caso.
 */
export async function extraerConClaude(buffer: Buffer): Promise<CpeExtraido | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const canvas = await renderizarPrimeraPagina(buffer, 2.5, LADO_LARGO_MAX_IA);
  const imagen = canvasParaClaude(canvas);

  const client = new Anthropic({ apiKey });
  const mensaje = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    tools: [HERRAMIENTA_EXTRACCION],
    tool_choice: { type: "tool", name: "extraer_cpe" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imagen.media_type, data: imagen.data } },
          {
            type: "text",
            text: "Esta imagen es una Carta de Porte Electrónica (CPE) Automotor de ARCA (ex AFIP), Argentina, o un documento relacionado que transcribe sus mismos datos (por ejemplo una nota de recepción, romaneo o ticket de pesaje/calidad emitido por el destino, como los de Cargill, Vicentin, ACA, etc.). El formato y las etiquetas varían según quién lo emite, así que mapeá por significado, no por el texto exacto de la etiqueta. Ejemplos de sinónimos frecuentes: chofer_nombre puede figurar como \"Chofer\", \"Conductor\" o \"Nombre Conductor\"; chofer_cuil como \"CUIL\" cerca del nombre del conductor; dominio_tractor como \"Dominio Tractor\", \"Patente Chasis\" o \"Patente Camión\"; dominio_acoplado como \"Dominio Acoplado\" o \"Patente Acoplado\"; producto_nombre como \"Producto\", \"Especie\" o \"Productos\". Extraé todos los campos pedidos usando esta lectura flexible. Fechas: cpe_fecha_emision en formato yyyy-mm-dd; ctg_vencimiento, fecha_partida, fecha_arribo y fecha_descarga en formato yyyy-mm-ddTHH:mm:ss (si falta la hora, usá 00:00:00). Si un dato realmente no está en el documento (bajo ningún nombre ni etiqueta), poné null — no inventes valores, pero tampoco pongas null solo porque la etiqueta no coincide textualmente con el nombre del campo.",
          },
        ],
      },
    ],
  });

  const usoHerramienta = mensaje.content.find((b) => b.type === "tool_use");
  if (!usoHerramienta || usoHerramienta.type !== "tool_use") return null;

  return usoHerramienta.input as CpeExtraido;
}
