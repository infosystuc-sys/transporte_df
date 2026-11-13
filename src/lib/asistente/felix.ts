import Anthropic from "@anthropic-ai/sdk";
import { hoyIso, prepararAccion, type EntradaHerramienta, type Propuesta } from "./acciones";
import { consultarSoloLectura } from "./consulta";
import { describirEsquema } from "./esquema";
import { ACCIONES_POR_ROL, NOTA_ROL, type RolFelix } from "./permisos";
import { registrar, type UsuarioFelix } from "./registro";

const MODELO = "claude-opus-5-5";
const MAX_VUELTAS = 10;

const INSTRUCCIONES = `Sos Félix, el asistente de la app de gestión de fletes de Grupo Don Félix (transporte de granos de Rafael Edmundo Sánchez, CUIT 20-23027102-0). Te escriben David (encargado, muchas veces desde el campo con el celular) y la gente de administración.

Tu trabajo es responder preguntas sobre los datos de la app consultando la base de datos con la herramienta consultar_base, y preparar algunas cargas que te pidan.

Qué podés cargar (siempre con las herramientas proponer_*):
- Gasoil: proponer_carga_gasoil. Ej. "cargá gasoil a Naranjo, 800 litros a 1.150", "gasoil AH499KV 400 L $ 1.020.000 comprobante 0005-00008189", o una foto del ticket.
- Carga de una carta de porte (fecha de carga y kilos de origen): proponer_carga_viaje.
- Descarga (fecha de descarga y kilos de destino, o una foto del ticket de balanza): proponer_descarga_viaje.
- Cambiar la tarifa de un viaje: proponer_cambio_tarifa.
- Borrar un viaje: proponer_borrar_viaje.
Cualquier otra cosa (adelantos, pagos, crear viajes nuevos, liquidaciones, LP) todavía no: decí que se hace desde la pantalla correspondiente de la app.

Cómo cargar:
- Las herramientas proponer_* NO guardan nada: arman una tarjeta con un botón Confirmar que ve el usuario. Recién cuando lo toca se guarda. Nunca digas que algo "ya quedó cargado": decí que lo revise y confirme.
- Antes de proponer, buscá con consultar_base los id que hacen falta (chofer, camión, viaje: viajes.id, no el número visible). Para "el viaje de Naranjo" sin más datos, es su viaje más reciente (el que está en curso si hay uno); si hay dudas entre dos viajes, preguntá cuál.
- Gasoil: los litros son obligatorios. Si te dan solo el importe ("800.000 pesos"), preguntá los litros o el precio por litro. Si no dicen viaje, pasá viaje_id en null: la app lo asocia sola al viaje en curso del chofer o al último que hizo. Si no dicen fecha, es hoy. La modalidad casi siempre es cuenta corriente; "lo pagó el chofer" = pagado_por_chofer.
- Si el usuario manda una foto o PDF de un comprobante, leelo y usá esos datos (fecha, litros, importe, N° de comprobante, patente, chofer) con usar_comprobante_adjunto en true, así la foto queda guardada. Si te falta algún dato, repetí en tu respuesta lo que leíste antes de preguntar.
- Podés proponer varias cosas en el mismo turno (ej. tres tickets de gasoil): una herramienta por cada una.
- Después de proponer, contestá corto: qué preparaste y "confirmalo con el botón". Si la herramienta devuelve un error, corregí o preguntá lo que falta.

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
- Gasoil: cargas_gasoil (fecha, camion_id, chofer_id, viaje_id, litros, importe, odometro, estacion_id, modalidad). Cada carga se asocia al viaje en curso (sin descarga) del chofer o camión, o si no hay, al último que hizo. "¿Cuánto gasoil usó el camión X en el viaje de la fecha Y?" = cargas de ese viaje; si no hay asociadas, cargas del camión entre la fecha de carga del viaje y la siguiente.
- Lo que se hizo con Félix queda en asistente_registro (tipo: pregunta, propuesta, confirmada o error; usuario_email; detalle en JSON). "¿Qué cargaste hoy?" o "¿quién confirmó tal gasoil?" = filas confirmadas.
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

const nulo = (tipo: "string" | "number" | "integer") => ({ type: [tipo, "null"] });
const fecha = { type: ["string", "null"], description: "aaaa-mm-dd; null = hoy o sin cambio." };

/** Herramientas que arman una propuesta (no guardan): ver acciones.ts. */
const HERRAMIENTAS_ACCIONES: Anthropic.Beta.BetaTool[] = [
  {
    name: "proponer_carga_gasoil",
    description:
      "Prepara una carga de gasoil para que el usuario la confirme con un botón. No guarda nada. Pasá los id buscados con consultar_base. Si no se sabe el camión, la app usa el del viaje o el habitual del chofer.",
    input_schema: {
      type: "object",
      properties: {
        fecha,
        camion_id: { ...nulo("integer"), description: "camiones.id" },
        chofer_id: { ...nulo("integer"), description: "choferes.id" },
        viaje_id: { ...nulo("integer"), description: "viajes.id; null = la app elige el viaje en curso o el último." },
        estacion_id: { ...nulo("integer"), description: "estaciones_servicio.id, si se sabe." },
        litros: { type: "number", description: "Litros cargados (obligatorio)." },
        precio_litro: nulo("number"),
        importe: { ...nulo("number"), description: "Importe total en pesos." },
        modalidad: { type: ["string", "null"], enum: ["cuenta_corriente", "pagado_por_chofer", "surtidor_propio", null] },
        comprobante_nro: nulo("string"),
        observaciones: nulo("string"),
        usar_comprobante_adjunto: { type: "boolean", description: "true si los datos salen de la foto/PDF que mandó el usuario." },
      },
      required: [
        "fecha",
        "camion_id",
        "chofer_id",
        "viaje_id",
        "estacion_id",
        "litros",
        "precio_litro",
        "importe",
        "modalidad",
        "comprobante_nro",
        "observaciones",
        "usar_comprobante_adjunto",
      ],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "proponer_carga_viaje",
    description:
      "Prepara la carga de un viaje (fecha de carga y kilos de origen) para que el usuario la confirme. No guarda nada. Mandá solo lo que cambia; lo demás en null.",
    input_schema: {
      type: "object",
      properties: {
        viaje_id: { type: "integer", description: "viajes.id" },
        fecha_carga: fecha,
        bruto_origen: nulo("number"),
        tara_origen: nulo("number"),
        neto_origen: { ...nulo("number"), description: "Kilos netos de origen." },
      },
      required: ["viaje_id", "fecha_carga", "bruto_origen", "tara_origen", "neto_origen"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "proponer_descarga_viaje",
    description:
      "Prepara la descarga de un viaje (fecha de descarga y kilos de destino) para que el usuario la confirme. No guarda nada. Mandá solo lo que cambia; lo demás en null.",
    input_schema: {
      type: "object",
      properties: {
        viaje_id: { type: "integer", description: "viajes.id" },
        fecha_descarga: fecha,
        bruto_destino: nulo("number"),
        tara_destino: nulo("number"),
        neto_destino: { ...nulo("number"), description: "Kilos netos de destino." },
        usar_comprobante_adjunto: { type: "boolean", description: "true si los datos salen del ticket que mandó el usuario." },
      },
      required: ["viaje_id", "fecha_descarga", "bruto_destino", "tara_destino", "neto_destino", "usar_comprobante_adjunto"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "proponer_cambio_tarifa",
    description: "Prepara el cambio de tarifa de un viaje para que el usuario lo confirme. No guarda nada. El flete se recalcula solo.",
    input_schema: {
      type: "object",
      properties: {
        viaje_id: { type: "integer", description: "viajes.id" },
        valor_tarifa: { type: "number", description: "Tarifa nueva en pesos (por tonelada salvo que digan otra cosa)." },
        modalidad_tarifa: {
          type: ["string", "null"],
          enum: ["por_tonelada", "por_km", "por_tonelada_km", "monto_fijo", null],
          description: "null = la que ya tiene el viaje.",
        },
      },
      required: ["viaje_id", "valor_tarifa", "modalidad_tarifa"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "proponer_borrar_viaje",
    description: "Prepara el borrado de un viaje para que el usuario lo confirme. No borra nada. No se puede si está liquidado o cobrado.",
    input_schema: {
      type: "object",
      properties: { viaje_id: { type: "integer", description: "viajes.id" } },
      required: ["viaje_id"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const TIPO_POR_HERRAMIENTA = {
  proponer_carga_gasoil: "cargar_gasoil",
  proponer_carga_viaje: "cargar_viaje",
  proponer_descarga_viaje: "descargar_viaje",
  proponer_cambio_tarifa: "cambiar_tarifa",
  proponer_borrar_viaje: "eliminar_viaje",
} as const;

// Uno por rol: cada uno queda en la caché de la IA por separado.
const sistemaCache = new Map<RolFelix, string>();
function sistema(rol: RolFelix) {
  let texto = sistemaCache.get(rol);
  if (!texto) {
    texto = INSTRUCCIONES + (NOTA_ROL[rol] ? `${NOTA_ROL[rol]}\n\n` : "") + describirEsquema(rol);
    sistemaCache.set(rol, texto);
  }
  return texto;
}

export type TurnoChat = { rol: "usuario" | "felix"; texto: string };

export type RespuestaFelix =
  | { ok: true; texto: string; consultas: number; acciones: Propuesta[] }
  | { ok: false; error: string };

/** Foto o PDF que mandó el usuario con su último mensaje. */
export type AdjuntoFelix = { media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf"; data: string };

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
export async function preguntarAFelix(
  historial: TurnoChat[],
  usuario: UsuarioFelix,
  rol: RolFelix,
  adjunto: AdjuntoFelix | null = null
): Promise<RespuestaFelix> {
  const permitidas = new Set(ACCIONES_POR_ROL[rol]);
  const herramientas = [
    HERRAMIENTA,
    ...HERRAMIENTAS_ACCIONES.filter((h) => permitidas.has(TIPO_POR_HERRAMIENTA[h.name as keyof typeof TIPO_POR_HERRAMIENTA])),
  ];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "Félix no está configurado (falta la clave de la IA)." };
  const client = new Anthropic({ apiKey });

  // Solo los últimos turnos: alcanza para las repreguntas y mantiene el pedido chico.
  const mensajes: Anthropic.Beta.BetaMessageParam[] = historial.slice(-12).map((t) => ({
    role: t.rol === "usuario" ? "user" : "assistant",
    content: t.texto,
  }));
  if (mensajes[0]?.role !== "user") mensajes.shift();
  // La foto o el PDF va con la última pregunta (la que se está respondiendo).
  const ultimo = mensajes.at(-1);
  if (adjunto && ultimo?.role === "user" && typeof ultimo.content === "string") {
    const bloque: Anthropic.Beta.BetaContentBlockParam =
      adjunto.media_type === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: adjunto.data } }
        : { type: "image", source: { type: "base64", media_type: adjunto.media_type, data: adjunto.data } };
    ultimo.content = [bloque, { type: "text", text: ultimo.content }];
  }

  const acciones: Propuesta[] = [];

  let consultas = 0;
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const respuesta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: sistema(rol), cache_control: { type: "ephemeral" } },
        { type: "text", text: `Hoy es ${hoyArgentina()} (${hoyIso()}). Te escribe: ${usuario.email}.` },
      ],
      tools: herramientas,
      messages: mensajes,
    });

    if (respuesta.stop_reason === "refusal") {
      return { ok: true, texto: "Perdón, esa no la puedo responder. Probá preguntarlo de otra forma.", consultas, acciones };
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
      return {
        ok: true,
        texto: texto || (acciones.length > 0 ? "Revisalo y confirmalo con el botón." : "No encontré qué responder. ¿Me lo preguntás de otra forma?"),
        consultas,
        acciones,
      };
    }

    // De a una: la conexión a la base es chica (ver src/db/index.ts).
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const uso of usos) {
      if (uso.name in TIPO_POR_HERRAMIENTA) {
        const tipo = TIPO_POR_HERRAMIENTA[uso.name as keyof typeof TIPO_POR_HERRAMIENTA];
        if (!permitidas.has(tipo)) {
          resultados.push({ type: "tool_result", tool_use_id: uso.id, content: "Error: este usuario no puede hacer eso.", is_error: true });
          continue;
        }
        const r = await prepararAccion({ tipo, entrada: uso.input } as EntradaHerramienta, adjunto != null).catch(
          (err: unknown) => {
            console.error("Félix: falló preparar", uso.name, err);
            return { ok: false as const, error: "No se pudo preparar. Probá de nuevo." };
          }
        );
        if (r.ok) {
          acciones.push(r.valor);
          await registrar(usuario, "propuesta", { tipo: r.valor.tipo, datos: r.valor.datos, titulo: r.valor.titulo });
        }
        resultados.push(
          r.ok
            ? {
                type: "tool_result",
                tool_use_id: uso.id,
                content: `Propuesta lista, todavía NO guardada: el usuario la ve con un botón Confirmar.\n${r.valor.titulo}\n${[...r.valor.detalle, ...r.valor.avisos].join("\n")}`,
              }
            : { type: "tool_result", tool_use_id: uso.id, content: `Error: ${r.error}`, is_error: true }
        );
        continue;
      }
      const consulta = (uso.input as { sql?: unknown }).sql;
      if (typeof consulta !== "string") {
        resultados.push({ type: "tool_result", tool_use_id: uso.id, content: "Falta el campo sql.", is_error: true });
        continue;
      }
      consultas++;
      const r = await consultarSoloLectura(consulta, rol);
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
