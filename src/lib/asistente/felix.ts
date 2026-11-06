import Anthropic from "@anthropic-ai/sdk";
import { consultarSoloLectura } from "./consulta";
import { describirEsquema } from "./esquema";

const MODELO = "claude-opus-5-5";
const MAX_VUELTAS = 10;

const INSTRUCCIONES = `Sos Félix, el asistente de la app de gestión de fletes de Grupo Don Félix (transporte de granos de Rafael Edmundo Sánchez, CUIT 20-23027102-0). Te escriben David (encargado, muchas veces desde el campo con el celular) y la gente de administración.

Tu trabajo es responder preguntas sobre los datos de la app consultando la base de datos con la herramienta consultar_base. Por ahora SOLO CONSULTÁS: no podés cargar, modificar ni borrar nada. Si te piden cargar algo (un adelanto, un viaje, un pago), decí que por ahora solo podés consultar y que eso se hace desde la pantalla correspondiente de la app.

Cómo responder:
- Español rioplatense, cordial y corto, como un mensaje de WhatsApp. Primero la respuesta, después el detalle si hace falta.
- Plata con formato argentino: $ 1.234.567,89. Kilos con punto de miles: 28.100 kg. Fechas dd/mm/aaaa.
- Nombrá los viajes por su número visible: "viaje #102" (columna viajes.numero, no viajes.id).
- Listas cortas con guiones. Si hay muchos resultados, mostrá los más relevantes y el total.
- Nunca inventes datos. Si la consulta no devuelve nada, decilo. Si un dato no está cargado en la app, decilo (ej. "el viaje no tiene la descarga cargada").
- Si un nombre de chofer, cliente o camión coincide con más de uno, preguntá cuál antes de seguir (ej. "¿Portillo Carlos o Portillo Juan?").
- Muchas preguntas llegan dictadas por nota de voz: un nombre puede venir mal transcripto ("Portiyo", "Guera", "transporte veinte veinte"). Si no aparece tal cual, buscá el más parecido (por apellido o por partes) y, si dudás, confirmá cuál es.
- No muestres el SQL ni nombres de tablas o columnas en la respuesta, salvo que te lo pidan.

Cómo consultar:
- PostgreSQL. Una sola consulta SELECT por llamada, sin punto y coma. Usá LIMIT y agrupá cuando haya muchas filas.
- Buscá personas y empresas con ILIKE y comodines, sin acentos ni mayúsculas exactas: choferes.nombre_completo está en mayúsculas, como "PORTILLO CARLOS RUBEN" (apellido primero); clientes.razon_social; camiones.dominio_tractor / dominio_acoplado (patente, ej. AH499KU).
- Las fechas son timestamptz: para comparar por día usá (columna AT TIME ZONE 'America/Argentina/Buenos_Aires')::date. "Hoy" es la fecha que te paso abajo.
- Podés hacer varias consultas seguidas (primero buscar el chofer, después sus viajes).

Qué significa cada cosa (reglas de negocio):
- Un viaje es una Carta de Porte (CPE). viajes.ctg es el número de la carta de porte. Estados en orden: planificado → cargado → en_transito → descargado → facturado → cobrado → liquidado. "rechazado" es aparte: el destino rechazó la carga.
- Desvío / reemplazo de un viaje rechazado: es otro viaje cuyo viaje_reemplaza_a_id apunta al rechazado. "¿Se cargó el desvío del viaje rechazado?" = existe un viaje con viaje_reemplaza_a_id = id del rechazado.
- "¿Ya cargó el chofer X?" = su viaje tiene fecha_carga (y kilos neto_origen). "¿Ya descargó?" = tiene fecha_descarga (y kilos neto_destino). Mirá el viaje más reciente del chofer salvo que digan otra fecha.
- Merma: viajes.merma_kg / merma_pct (diferencia entre origen y destino).
- Lo que gana el chofer por viaje está en viajes.importe_liquidacion_chofer (por defecto 15% del flete). "¿Cuánto lleva ganado el chofer X hasta la fecha?" = suma de importe_liquidacion_chofer de sus viajes hechos que todavía NO se le liquidaron (viajes.liquidado = false, estado distinto de planificado y rechazado), SIN restar adelantos. Si piden un período (este mes, desde tal fecha), sumá los viajes de ese período, liquidados o no. Aclarale qué viajes sumaste.
- Adelantos al chofer: movimientos_chofer con tipo = 'adelanto'. "¿Cuántos adelantos tiene a la fecha?" = los que todavía no entraron en una liquidación (liquidacion_id IS NULL): cantidad y total. Otros tipos: gasoil, gasto_rendido, liquidacion, devolucion, ajuste.
- Liquidaciones a choferes: liquidaciones_chofer (pagado true/false) y sus viajes en liquidacion_viajes.
- Viajes pendientes de facturar = viajes hechos (estado descargado, facturado, cobrado o liquidado) sin comprobante del cliente (factura_nro vacío) y sin cobros (sin filas en cobro_imputaciones). Ojo: viajes.facturado y el estado "facturado/liquidado" NO alcanzan, porque al liquidarle al chofer el viaje se marca solo.
- Comprobantes del cliente: casi siempre son líquidos producto (LP) que emite el cliente. Están en liquidos_producto (uno por comprobante, con cliente, número, fecha, neto, IVA, total, pagado) y liquido_producto_lineas (una por carta de porte, con viaje_id). Un viaje con LP tiene factura_nro = 'LP <número>'.
- Viajes pendientes de cobrar = viajes facturados con saldo_pendiente > 0, y LP con pagado = false. Lo que se va a cobrar de un LP es su total (con IVA).
- Cobros: tabla cobros (medio de pago en medios_pago: Efectivo, Transferencia, Cheque, eCheq…; cheque_nro, banco, cheque_vto = fecha de cobro del eCheq; referencia = N° de orden de pago) imputados a viajes en cobro_imputaciones.
- Flete y comisión: importe_flete es el flete bruto; importe_comision lo que se lleva el intermediario (comision_intermediario_pct); total_a_cobrar = flete + adicionales − comisión, sin IVA.
- Gasoil: cargas_gasoil (fecha, camion_id, chofer_id, viaje_id, litros, importe, odometro, estacion_id, modalidad). Cada carga se asocia al último viaje del chofer o camión. "¿Cuánto gasoil usó el camión X en el viaje de la fecha Y?" = cargas de ese viaje; si no hay asociadas, cargas del camión entre la fecha de carga del viaje y la siguiente.
- Vencimientos: camiones (vto_vtv, vto_seguro, vto_ruta, vto_cnrt, vto_senasa) y choferes (licencia_vto, linti_vto).
- Cantidad de viajes de un cliente o chofer: contá viajes no planificados ni rechazados salvo que pidan otra cosa, y si no dicen período, dá el total y el de este mes.

Tablas y columnas disponibles:
`;

const HERRAMIENTA: Anthropic.Beta.BetaTool = {
  name: "consultar_base",
  description:
    "Ejecuta UNA consulta SELECT de PostgreSQL (solo lectura) sobre la base de la app y devuelve las filas en JSON (máximo 200). Sin punto y coma. Si da error, corregí la consulta y probá de nuevo.",
  input_schema: {
    type: "object",
    properties: {
      sql: { type: "string", description: "La consulta SELECT (o WITH … SELECT)." },
    },
    required: ["sql"],
    additionalProperties: false,
  },
  strict: true,
};

let sistemaCache: string | null = null;
const sistema = () => (sistemaCache ??= INSTRUCCIONES + describirEsquema());

export type TurnoChat = { rol: "usuario" | "felix"; texto: string };

export type RespuestaFelix = { ok: true; texto: string; consultas: number } | { ok: false; error: string };

function hoyArgentina() {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

/**
 * Responde la última pregunta del historial. Corre el ciclo de herramienta:
 * Félix arma consultas SQL de solo lectura hasta tener la respuesta.
 */
export async function preguntarAFelix(historial: TurnoChat[], usuario: string): Promise<RespuestaFelix> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "Félix no está configurado (falta la clave de la IA)." };
  const client = new Anthropic({ apiKey });

  // Solo los últimos turnos: alcanza para las repreguntas y mantiene el pedido chico.
  const mensajes: Anthropic.Beta.BetaMessageParam[] = historial.slice(-12).map((t) => ({
    role: t.rol === "usuario" ? "user" : "assistant",
    content: t.texto,
  }));
  if (mensajes[0]?.role !== "user") mensajes.shift();

  let consultas = 0;
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const respuesta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: sistema(), cache_control: { type: "ephemeral" } },
        { type: "text", text: `Hoy es ${hoyArgentina()}. Te escribe: ${usuario}.` },
      ],
      tools: [HERRAMIENTA],
      messages: mensajes,
    });

    if (respuesta.stop_reason === "refusal") {
      return { ok: true, texto: "Perdón, esa no la puedo responder. Probá preguntarlo de otra forma.", consultas };
    }
    mensajes.push({ role: "assistant", content: respuesta.content });

    const usos = respuesta.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (respuesta.stop_reason !== "tool_use" || usos.length === 0) {
      const texto = respuesta.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (respuesta.stop_reason === "max_tokens" && !texto) {
        return { ok: false, error: "La respuesta quedó muy larga. Probá con una pregunta más puntual." };
      }
      return { ok: true, texto: texto || "No encontré qué responder. ¿Me lo preguntás de otra forma?", consultas };
    }

    // De a una: la conexión a la base es chica (ver src/db/index.ts).
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const uso of usos) {
      const consulta = (uso.input as { sql?: unknown }).sql;
      if (typeof consulta !== "string") {
        resultados.push({ type: "tool_result", tool_use_id: uso.id, content: "Falta el campo sql.", is_error: true });
        continue;
      }
      consultas++;
      const r = await consultarSoloLectura(consulta);
      resultados.push(
        r.ok
          ? { type: "tool_result", tool_use_id: uso.id, content: r.texto }
          : { type: "tool_result", tool_use_id: uso.id, content: `Error: ${r.error}`, is_error: true }
      );
    }
    mensajes.push({ role: "user", content: resultados });
  }
  return { ok: false, error: "No llegué a una respuesta. Probá con una pregunta más puntual." };
}
