/**
 * Parser de la Carta de Porte Electrónica (CPE) de ARCA a partir del texto
 * plano que extrae unpdf. El texto sale en un orden bastante distinto al
 * de lectura visual (rasgo del propio PDF, no de la librería), así que en
 * vez de matchear "etiqueta seguida de valor" en general, cada campo usa
 * el patrón exacto que se observó extrayendo el texto de una CPE real
 * (ver fixtures/cpe/10133965615.pdf) — el layout de ARCA es un template
 * fijo, entonces el orden debería repetirse en cualquier CPE.
 *
 * Nunca se guarda nada de acá directo: todo pasa por la pantalla de
 * revisión, así que un campo mal parseado simplemente se corrige a mano.
 */

export type CpeExtraido = {
  ctg: string | null;
  cpe_nro: string | null;
  cpe_fecha_emision: string | null; // yyyy-mm-dd
  ctg_vencimiento: string | null; // yyyy-mm-ddTHH:mm:ss
  campania: string | null;
  declaracion_calidad: "conforme" | "condicional" | null;

  titular_cuit: string | null;
  titular_nombre: string | null;
  destinatario_cuit: string | null;
  destinatario_nombre: string | null;
  pagador_cuit: string | null;
  pagador_nombre: string | null;
  chofer_cuil: string | null;
  chofer_nombre: string | null;

  producto_nombre: string | null;
  bruto_origen_kg: number | null;
  tara_origen_kg: number | null;
  neto_origen_kg: number | null;

  origen_localidad: string | null;
  origen_provincia: string | null;

  destino_n_planta: string | null;
  destino_direccion: string | null;
  destino_localidad: string | null;
  destino_provincia: string | null;

  dominio_tractor: string | null;
  dominio_acoplado: string | null;
  fecha_partida: string | null; // yyyy-mm-ddTHH:mm:ss
  km: number | null;
  valor_tarifa: number | null;

  fecha_arribo: string | null;
  fecha_descarga: string | null;
  n_turno_descarga: string | null;
  bruto_destino_kg: number | null;
  tara_destino_kg: number | null;
  neto_destino_kg: number | null;
};

function aIso(fechaDDMMYYYY: string): string {
  const [d, m, y] = fechaDDMMYYYY.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function numero(texto: string | undefined): number | null {
  if (!texto) return null;
  const n = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export function parseTextoCpe(texto: string): CpeExtraido {
  const resultado: CpeExtraido = {
    ctg: null,
    cpe_nro: null,
    cpe_fecha_emision: null,
    ctg_vencimiento: null,
    campania: null,
    declaracion_calidad: null,
    titular_cuit: null,
    titular_nombre: null,
    destinatario_cuit: null,
    destinatario_nombre: null,
    pagador_cuit: null,
    pagador_nombre: null,
    chofer_cuil: null,
    chofer_nombre: null,
    producto_nombre: null,
    bruto_origen_kg: null,
    tara_origen_kg: null,
    neto_origen_kg: null,
    origen_localidad: null,
    origen_provincia: null,
    destino_n_planta: null,
    destino_direccion: null,
    destino_localidad: null,
    destino_provincia: null,
    dominio_tractor: null,
    dominio_acoplado: null,
    fecha_partida: null,
    km: null,
    valor_tarifa: null,
    fecha_arribo: null,
    fecha_descarga: null,
    n_turno_descarga: null,
    bruto_destino_kg: null,
    tara_destino_kg: null,
    neto_destino_kg: null,
  };

  const ctg = texto.match(/CTG:\s*(\d+)/);
  if (ctg) resultado.ctg = ctg[1];

  // "00001-00011691\n30/07/2026 10:53\nFecha:\nVencimiento:\n28/07/2026\nN° CPE:"
  const cabecera = texto.match(
    /(\d{5}-\d{8})\s*\n(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s*\nFecha:\s*\nVencimiento:\s*\n(\d{2}\/\d{2}\/\d{4})/
  );
  if (cabecera) {
    resultado.cpe_nro = cabecera[1];
    resultado.ctg_vencimiento = `${aIso(cabecera[2])}T${cabecera[3]}:00`;
    resultado.cpe_fecha_emision = aIso(cabecera[4]);
  }

  // Los 4 pares CUIT - Razón Social que aparecen en bloque antes de
  // "A - INTERVINIENTES": titular, destinatario, destino (redundante),
  // empresa transportista (somos nosotros, se ignora).
  const paresCuit = [
    ...texto.matchAll(/(\d{11})\s*-\s*([^\n]+?)(?=\n|Flete pagador|Chofer\s*:)/g),
  ];
  if (paresCuit[0]) {
    resultado.titular_cuit = paresCuit[0][1];
    resultado.titular_nombre = paresCuit[0][2].trim();
  }
  if (paresCuit[1]) {
    resultado.destinatario_cuit = paresCuit[1][1];
    resultado.destinatario_nombre = paresCuit[1][2].trim();
  }

  const pagador = texto.match(/(\d{11})\s*-\s*([^\n]+?)Flete pagador\s*:/);
  if (pagador) {
    resultado.pagador_cuit = pagador[1];
    resultado.pagador_nombre = pagador[2].trim();
  }

  const chofer = texto.match(/Chofer\s*:\s*(\d{11})\s*-\s*([^\n]+)/);
  if (chofer) {
    resultado.chofer_cuil = chofer[1];
    resultado.chofer_nombre = chofer[2].trim();
  }

  // "Peso Bruto Peso Tara\nPeso Neto\nMaíz Maiz\n50980 18460\n32520\nCampaña: 2526"
  const granoYPesos = texto.match(
    /Peso Bruto Peso Tara\s*\nPeso Neto\s*\n([^\n]+?)\s*\n(\d+)\s+(\d+)\s*\n(\d+)\s*\nCampaña:\s*(\S+)/
  );
  if (granoYPesos) {
    // El nombre del grano viene duplicado ("Maíz Maiz" = grano + tipo): nos
    // quedamos con la primera palabra.
    resultado.producto_nombre = granoYPesos[1].trim().split(/\s+/)[0];
    resultado.bruto_origen_kg = numero(granoYPesos[2]);
    resultado.tara_origen_kg = numero(granoYPesos[3]);
    resultado.neto_origen_kg = numero(granoYPesos[4]);
    resultado.campania = granoYPesos[5];
  }

  // Nota: "Conforme" y "Condicional" son las dos opciones del checkbox y
  // ambas quedan siempre en el texto extraído sin importar cuál está
  // tildada — no hay forma confiable de saber cuál se marcó solo con
  // texto, así que declaracion_calidad queda para revisión manual.

  // "Localidad: ProvinciaSIETE DE ABRIL * TUCUMAN"
  const procedencia = texto.match(/Localidad:\s*Provincia([^\n*]+?)\s*\*\s*([^\n]+)/);
  if (procedencia) {
    resultado.origen_localidad = procedencia[1].trim();
    resultado.origen_provincia = procedencia[2].trim();
  }

  // "D - DESTINO DE LA MERCADERÍA\nN° Planta\nLocalidad: Provincia:\nDirección:\nFRIAS\n25648 RUTA NACIONAL 157 KM 1052\nSGO.DEL ESTERO"
  const destino = texto.match(
    /D - DESTINO DE LA MERCADERÍA\s*\nN° Planta\s*\nLocalidad:\s*Provincia:\s*\nDirección:\s*\n([^\n]+)\s*\n(\d+)\s+([^\n]+?)\s*\n([^\n]+?)\s*\nEs un campo/
  );
  if (destino) {
    resultado.destino_localidad = destino[1].trim();
    resultado.destino_n_planta = destino[2].trim();
    resultado.destino_direccion = destino[3].trim();
    resultado.destino_provincia = destino[4].trim();
  }

  // "Dominios:\nKms. a recorrer:Partida:\nAG424SW - AH507SV\n28/07/2026 22:53:00 300\n36200Tarifa:"
  const transporte = texto.match(
    /Dominios:\s*\nKms\.\s*a recorrer:Partida:\s*\n([A-Z0-9]+)\s*-\s*([A-Z0-9]+)\s*\n(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s*\n(\d+)Tarifa:/
  );
  if (transporte) {
    resultado.dominio_tractor = transporte[1];
    resultado.dominio_acoplado = transporte[2];
    resultado.fecha_partida = `${aIso(transporte[3])}T${transporte[4]}`;
    resultado.km = numero(transporte[5]);
    resultado.valor_tarifa = numero(transporte[6]);
  }

  return resultado;
}
