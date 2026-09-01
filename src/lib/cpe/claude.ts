import Anthropic from "@anthropic-ai/sdk";
import { canvasParaClaude, LADO_LARGO_MAX_IA, renderizarPrimeraPagina } from "./render";
import { limpiarCamposTexto } from "@/lib/ia/sanear";
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
      campos_dudosos: {
        type: "array",
        items: { type: "string", enum: [...CAMPOS_TEXTO, ...CAMPOS_NUMERO] },
        description:
          "Nombres de los campos de arriba que pudiste completar pero con baja confianza (texto borroso, poco iluminado, o que tuviste que inferir en vez de leer directamente). No incluyas acá los que ya pusiste en null.",
      },
    },
    required: [...CAMPOS_TEXTO, ...CAMPOS_FECHA, ...CAMPOS_NUMERO, "declaracion_calidad", "campos_dudosos"],
  },
};

/** Nombres válidos para campos_dudosos -- cualquier otro valor que Claude invente se descarta. */
const NOMBRES_CAMPOS_VALIDOS = new Set<string>([...CAMPOS_TEXTO, ...CAMPOS_NUMERO]);

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
    // Opus en vez de Sonnet: lee bastante mejor fotos degradadas (poca luz,
    // comprimidas por WhatsApp) -- el volumen de CPE es bajo, así que el
    // costo extra por token no pesa frente a la mejora de precisión.
    model: "claude-opus-5",
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
            text: "Esta imagen es una Carta de Porte Electrónica (CPE) Automotor de ARCA (ex AFIP), Argentina, o un documento relacionado que transcribe sus mismos datos (por ejemplo una nota de recepción, romaneo o ticket de pesaje/calidad emitido por el destino, como los de Cargill, Vicentin, ACA, etc.). El formato y las etiquetas varían según quién lo emite, así que mapeá por significado, no por el texto exacto de la etiqueta. Ejemplos de sinónimos frecuentes: chofer_nombre puede figurar como \"Chofer\", \"Conductor\" o \"Nombre Conductor\"; chofer_cuil como \"CUIL\" cerca del nombre del conductor; dominio_tractor como \"Dominio Tractor\", \"Patente Chasis\" o \"Patente Camión\"; dominio_acoplado como \"Dominio Acoplado\" o \"Patente Acoplado\"; producto_nombre como \"Producto\", \"Especie\" o \"Productos\". Extraé todos los campos pedidos usando esta lectura flexible. Fechas: cpe_fecha_emision en formato yyyy-mm-dd; ctg_vencimiento, fecha_partida, fecha_arribo y fecha_descarga en formato yyyy-mm-ddTHH:mm:ss (si falta la hora, usá 00:00:00). Si un dato realmente no está en el documento (bajo ningún nombre ni etiqueta), poné null — no inventes valores, pero tampoco pongas null solo porque la etiqueta no coincide textualmente con el nombre del campo. La imagen puede venir con calidad degradada (foto de celular comprimida, poca luz, texto chico) — cuando completes un campo pero no estés del todo seguro de haberlo leído bien (letra o número ambiguo, borroso, o tuviste que inferirlo en vez de leerlo directo), agregá el nombre de ese campo a campos_dudosos en vez de fingir certeza. Es preferible marcar de más que de menos: la persona que revisa el formulario después va a mirar con más cuidado justo esos campos.",
          },
        ],
      },
    ],
  });

  const usoHerramienta = mensaje.content.find((b) => b.type === "tool_use");
  if (!usoHerramienta || usoHerramienta.type !== "tool_use") return null;

  // Claude a veces contesta "unknown"/"n/a" en vez de null pese al prompt --
  // ver sanear.ts. Sin esto, extraccionInsuficiente() no detecta el CTG
  // ilegible (piensa que sí hay un valor) y el matching intentaría buscar
  // un cliente/chofer literal llamado "unknown".
  const extraido = limpiarCamposTexto(usoHerramienta.input as CpeExtraido, CAMPOS_TEXTO);

  // Por si Claude inventa un nombre de campo que no existe (pese al enum
  // del schema) o marca como dudoso un campo que igual vino en null.
  extraido.campos_dudosos = (extraido.campos_dudosos ?? []).filter(
    (campo) => NOMBRES_CAMPOS_VALIDOS.has(campo) && extraido[campo as keyof CpeExtraido] != null
  );

  return extraido;
}
