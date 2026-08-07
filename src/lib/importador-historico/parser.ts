/**
 * Parser del Excel histórico de viajes (planillas anuales por tipo de
 * carga, ej. "CAMIONES ARROZ 2026" — ver fixtures/excel-historico/*.jpeg).
 * Se construyó guiándose por una captura de pantalla real (no el .xlsx
 * original, que la empresa no tenía disponible), así que además de las
 * columnas visibles hay que tolerar variaciones que la captura no cubre:
 * fechas mixtas ("7/1/2026" vs "14-feb", ambas puede venir como Date real
 * de Excel o como texto tipeado a mano), filas de subtotal sin fecha ni
 * CTG (solo un importe en la columna del chofer), y nombres de lugar con
 * variantes de escritura ("Mojon de Fierro" / "Mijon de Fierro" /
 * "MOJON DE FIERRO").
 */

export type FilaHistoricaExtraida = {
  filaExcel: number; // número de fila real en la hoja, 1-indexado, para mensajes de error
  fecha_carga: string | null; // yyyy-mm-dd
  ctg: string | null;
  origen_nombre: string | null;
  destino_nombre: string | null;
  valor_tarifa: number | null;
  tn_origen: number | null;
  tn_destino: number | null;
  total_hoja: number | null; // el TOTAL tal cual viene en la planilla, solo a título informativo/validación
  chofer_15pct: number | null; // "15% CHOFER" tal cual viene, snapshot informativo
};

export type ResultadoParseoHoja = {
  hoja: string;
  productoSugerido: string | null;
  filas: FilaHistoricaExtraida[];
  filasOmitidas: number;
};

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas de acento combinantes tras NFD
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Infiere el producto a partir del nombre de la hoja (ej. "Camiones Arroz 2026" -> "Arroz"). */
export function inferirProductoDeHoja(nombreHoja: string): string | null {
  const n = normalizar(nombreHoja);
  if (n.includes("ARROZ")) return "Arroz";
  if (n.includes("MAIZ") || n.includes("MAÍZ")) return "Maíz";
  if (n.includes("SOJA")) return "Soja";
  if (n.includes("TRIGO")) return "Trigo";
  if (n.includes("FERTILIZANTE")) return "Fertilizante";
  return null;
}

/** Año que aparece en el nombre de la hoja (ej. "CAMIONES ARROZ 2026" -> 2026), si hay. */
function inferirAnioDeHoja(nombreHoja: string): number | null {
  const m = nombreHoja.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

function aIso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Convierte una celda de fecha a yyyy-mm-dd. Acepta un objeto Date (así
 * llegan las fechas reales de Excel cuando se lee con cellDates: true,
 * sin importar el formato de visualización — "7/1/2026" y "14-feb" son
 * el mismo tipo de dato con distinto formato) o texto tipeado a mano en
 * alguno de los dos formatos vistos en la captura real. `anioDefecto` se
 * usa para fechas sin año explícito ("14-feb"): arranca en el año de la
 * hoja y se actualiza con cada fecha completa que aparece más abajo.
 */
function parsearFecha(valor: unknown, anioDefecto: number): { iso: string | null; anio: number } {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return { iso: valor.toISOString().slice(0, 10), anio: valor.getUTCFullYear() };
  }

  if (typeof valor === "string") {
    const texto = valor.trim();

    const completa = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (completa) {
      const [, d, m, y] = completa;
      return { iso: aIso(Number(y), Number(m), Number(d)), anio: Number(y) };
    }

    const abreviada = texto.match(/^(\d{1,2})[-\/]([a-zA-Záéíóú]{3,4})\.?$/);
    if (abreviada) {
      const [, d, nombreMes] = abreviada;
      const mes = MESES[normalizar(nombreMes).slice(0, 3).toLowerCase()];
      if (mes) return { iso: aIso(anioDefecto, mes, Number(d)), anio: anioDefecto };
    }
  }

  return { iso: null, anio: anioDefecto };
}

function numero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") {
    const limpio = valor.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(limpio);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function texto(valor: unknown): string | null {
  if (valor == null) return null;
  const s = String(valor).trim();
  return s === "" ? null : s;
}

type MapaColumnas = {
  fecha?: number;
  ctg?: number;
  origen?: number;
  destino?: number;
  tarifa?: number;
  tnOrigen?: number;
  tnDestino?: number;
  total?: number;
  chofer?: number;
};

function detectarColumnas(fila: unknown[]): MapaColumnas | null {
  const mapa: MapaColumnas = {};
  fila.forEach((celda, i) => {
    if (typeof celda !== "string") return;
    const n = normalizar(celda);
    if (n === "FECHA") mapa.fecha = i;
    else if (n.includes("CTG")) mapa.ctg = i;
    else if (n.includes("ORIGEN") && !n.includes("TN")) mapa.origen = i;
    else if (n.includes("DESTINO") && !n.includes("TN")) mapa.destino = i;
    else if (n === "TARIFA") mapa.tarifa = i;
    else if (n.includes("TN") && n.includes("ORIGEN")) mapa.tnOrigen = i;
    else if (n.includes("TN") && n.includes("DESTINO")) mapa.tnDestino = i;
    else if (n === "TOTAL") mapa.total = i;
    else if (n.includes("CHOFER")) mapa.chofer = i;
  });
  // Mínimo indispensable para reconocer la fila como encabezado real.
  if (mapa.fecha == null || mapa.ctg == null) return null;
  return mapa;
}

/** Parsea una hoja completa (array de arrays, ver XLSX.utils.sheet_to_json con header: 1). */
export function parsearHojaHistorica(nombreHoja: string, filasCrudas: unknown[][]): ResultadoParseoHoja {
  let columnas: MapaColumnas | null = null;
  let indiceEncabezado = -1;
  for (let i = 0; i < Math.min(filasCrudas.length, 10); i++) {
    columnas = detectarColumnas(filasCrudas[i]);
    if (columnas) {
      indiceEncabezado = i;
      break;
    }
  }

  if (!columnas) {
    return { hoja: nombreHoja, productoSugerido: inferirProductoDeHoja(nombreHoja), filas: [], filasOmitidas: 0 };
  }

  let anioActual = inferirAnioDeHoja(nombreHoja) ?? new Date().getFullYear();
  const filas: FilaHistoricaExtraida[] = [];
  let filasOmitidas = 0;

  for (let i = indiceEncabezado + 1; i < filasCrudas.length; i++) {
    const fila = filasCrudas[i];
    if (!fila || fila.every((c) => c == null || c === "")) continue; // fila totalmente vacía

    const valorFecha = columnas.fecha != null ? fila[columnas.fecha] : null;
    const valorCtg = columnas.ctg != null ? texto(fila[columnas.ctg]) : null;

    // Filas de subtotal (o cualquier fila sin fecha ni CTG): se ignoran,
    // no representan un viaje individual (confirmado contra la captura real).
    if ((valorFecha == null || valorFecha === "") && !valorCtg) {
      filasOmitidas++;
      continue;
    }

    const { iso: fechaIso, anio } = parsearFecha(valorFecha, anioActual);
    anioActual = anio;

    filas.push({
      filaExcel: i + 1,
      fecha_carga: fechaIso,
      ctg: valorCtg,
      origen_nombre: columnas.origen != null ? texto(fila[columnas.origen]) : null,
      destino_nombre: columnas.destino != null ? texto(fila[columnas.destino]) : null,
      valor_tarifa: columnas.tarifa != null ? numero(fila[columnas.tarifa]) : null,
      tn_origen: columnas.tnOrigen != null ? numero(fila[columnas.tnOrigen]) : null,
      tn_destino: columnas.tnDestino != null ? numero(fila[columnas.tnDestino]) : null,
      total_hoja: columnas.total != null ? numero(fila[columnas.total]) : null,
      chofer_15pct: columnas.chofer != null ? numero(fila[columnas.chofer]) : null,
    });
  }

  return {
    hoja: nombreHoja,
    productoSugerido: inferirProductoDeHoja(nombreHoja),
    filas,
    filasOmitidas,
  };
}
