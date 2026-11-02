/**
 * Parser del "Líquido Producto" (comprobante ARCA cód. 060) que emiten los
 * clientes cuando le liquidan los fletes a la empresa, a partir del texto
 * plano que extrae unpdf. Hay dos formatos vistos en LP reales:
 * - parseTextoLp: el de "Soft Raíces - Gestión para Transportistas"
 *   (ej. Transporte 2020), importes con punto decimal.
 * - parseTextoCvlp: la "Cuenta Venta y Líquido Producto" de Transporte
 *   Buenos Viajes, importes con coma decimal y la comisión como línea
 *   negativa con el mismo CTG. No trae el CUIT del emisor como texto (va
 *   en el logo); procesarLp lo completa desde el QR de ARCA.
 * Si ninguno matchea, procesarLp cae a la lectura por IA.
 *
 * Nunca se guarda nada de acá directo: todo pasa por la pantalla de
 * revisión, que compara cada línea contra el viaje de ese CTG.
 */

export type LineaLp = {
  ctg: string;
  kg: number | null;
  tarifa: number | null;
  km: number | null;
  /** Flete bruto de la línea (kg × tarifa). */
  total: number;
  /** "Comisión por Flete" descontada en esa línea (positivo). */
  comision: number;
  /** Otros descuentos de la línea que no son comisión (positivo). */
  otros_descuentos: number;
};

export type LpExtraido = {
  numero: string | null; // "A0002-00007078"
  fecha: string | null; // yyyy-mm-dd
  emisor_cuit: string | null; // solo dígitos
  receptor_cuit: string | null; // solo dígitos
  cae: string | null;
  lineas: LineaLp[];
  neto_gravado: number | null;
  iva: number | null;
  total: number | null;
};

/** "1,054,800.00" o "1054,800.00" (el PDF no siempre separa el millón) → 1054800. */
function numero(texto: string): number {
  return Number(texto.replace(/,/g, ""));
}

const IMPORTE = String.raw`\d+(?:,\d{3})*\.\d{2}`;

// "<propietario> <producto> 10135330637 <procedencia> <destino> 829,200.00150 27640 30,000.00"
// El PDF pega el total con los km ("829,200.00" + "150"): el total siempre
// tiene exactamente dos decimales, así que lo que sigue son los km.
const LINEA_VIAJE = new RegExp(
  String.raw`(\d{11})\s+.*?\s(${IMPORTE})(\d*)\s+(\d+)\s+(${IMPORTE})\s*$`
);
// "Comisión por Flete -66,336.00" (u otro descuento de la línea anterior)
const LINEA_DESCUENTO = new RegExp(String.raw`^(.*\S)\s+-(${IMPORTE})\s*$`);
// "3,452,208.00 724,963.68 4,177,171.680.00" → neto, IVA, total y no gravado pegados.
const LINEA_TOTALES = new RegExp(String.raw`^(${IMPORTE})\s+(${IMPORTE})\s+(${IMPORTE})(${IMPORTE})\s*$`);

const soloDigitos = (v: string) => v.replace(/[^0-9]/g, "");

export function parseTextoLp(texto: string): LpExtraido {
  const resultado: LpExtraido = {
    numero: null,
    fecha: null,
    emisor_cuit: null,
    receptor_cuit: null,
    cae: null,
    lineas: [],
    neto_gravado: null,
    iva: null,
    total: null,
  };

  const nro = texto.match(/L[ií]quido Producto\s*N[º°o]?\s*([A-Z]?\d{4,5}-\d{8})/i);
  if (nro) resultado.numero = nro[1];

  // "Los Surgentes (Córdoba), 30/09/2026"
  const fecha = texto.match(/,\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (fecha) resultado.fecha = `${fecha[3]}-${fecha[2]}-${fecha[1]}`;

  // El primer "CUIT: xx-xxxxxxxx-x" es el del emisor (encabezado); el del
  // receptor aparece suelto debajo de su razón social.
  const emisor = texto.match(/CUIT:\s*(\d{2}-?\d{8}-?\d)/);
  if (emisor) resultado.emisor_cuit = soloDigitos(emisor[1]);
  const cuits = [...texto.matchAll(/\b(\d{2}-\d{8}-\d)\b/g)].map((m) => soloDigitos(m[1]));
  resultado.receptor_cuit = cuits.find((c) => c !== resultado.emisor_cuit) ?? null;

  const cae = texto.match(/CAE:\s*(\d{14})/);
  if (cae) resultado.cae = cae[1];

  let ultima: LineaLp | null = null;
  for (const linea of texto.split("\n")) {
    const viaje = linea.match(LINEA_VIAJE);
    if (viaje) {
      ultima = {
        ctg: viaje[1],
        total: numero(viaje[2]),
        km: viaje[3] ? Number(viaje[3]) : null,
        kg: Number(viaje[4]),
        tarifa: numero(viaje[5]),
        comision: 0,
        otros_descuentos: 0,
      };
      resultado.lineas.push(ultima);
      continue;
    }

    const descuento = linea.match(LINEA_DESCUENTO);
    if (descuento && ultima) {
      if (/comisi[oó]n/i.test(descuento[1])) ultima.comision += numero(descuento[2]);
      else ultima.otros_descuentos += numero(descuento[2]);
      continue;
    }

    const totales = linea.match(LINEA_TOTALES);
    if (totales) {
      resultado.neto_gravado = numero(totales[1]);
      resultado.iva = numero(totales[2]);
      resultado.total = numero(totales[3]);
    }
  }

  return resultado;
}

// ---------- Formato "Cuenta Venta y Líquido Producto" (Buenos Viajes) ----------

/** "1.712.440,00" / "62000,000" / "-137.020,00" → número. */
function numeroAr(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", "."));
}

const IMPORTE_AR = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`;

// "10135546888 11/10/26 QUIMILI SAN LORENZO SOJA GUERRA ANDRES 27,620 TN 62000,000 1.712.440,00"
// "10135546888 11/10/26 COMIS MERC TR COMISION MERCADE GUERRA ANDRES 2,210 TN -62000,000 -137.020,00"
const LINEA_CVLP = new RegExp(
  String.raw`^(\d{11})\s+\d{2}\/\d{2}\/\d{2}\s+(.*?)\s+(\d+,\d{3})\s+TN\s+(-?\d+,\d+)\s+(${IMPORTE_AR})\s*$`
);

export function parseTextoCvlp(texto: string): LpExtraido {
  const resultado: LpExtraido = {
    numero: null,
    fecha: null,
    emisor_cuit: null,
    receptor_cuit: null,
    cae: null,
    lineas: [],
    neto_gravado: null,
    iva: null,
    total: null,
  };
  if (!/CUENTA VENTA Y LIQU/i.test(texto)) return resultado;

  // "* A * Nº0006 -00012405"
  const nro = texto.match(/\*\s*([A-Z])\s*\*\s*N[º°o]?\s*(\d{4})\s*-\s*(\d{8})/);
  if (nro) resultado.numero = `${nro[1]}${nro[2]}-${nro[3]}`;

  const fecha = texto.match(/Fecha\s+(\d{2})\/(\d{2})\/(\d{4})/);
  if (fecha) resultado.fecha = `${fecha[3]}-${fecha[2]}-${fecha[1]}`;

  const receptor = texto.match(/C\.U\.I\.T:?\s*(\d{2}-?\d{8}-?\d)/);
  if (receptor) resultado.receptor_cuit = soloDigitos(receptor[1]);

  const cae = texto.match(/CAE\s+(\d{14})/);
  if (cae) resultado.cae = cae[1];

  const porCtg = new Map<string, LineaLp>();
  for (const linea of texto.split("\n")) {
    const m = linea.match(LINEA_CVLP);
    if (!m) continue;
    const [, ctg, detalle, toneladas, tarifa, importe] = m;
    const monto = numeroAr(importe);
    // La comisión viene como una línea más del mismo CTG, en negativo.
    if (monto < 0 || /COMIS/i.test(detalle)) {
      const viaje = porCtg.get(ctg);
      if (!viaje) continue;
      if (/COMIS/i.test(detalle)) viaje.comision += Math.abs(monto);
      else viaje.otros_descuentos += Math.abs(monto);
      continue;
    }
    const viaje: LineaLp = {
      ctg,
      kg: Math.round(numeroAr(toneladas) * 1000),
      tarifa: numeroAr(tarifa),
      km: null,
      total: monto,
      comision: 0,
      otros_descuentos: 0,
    };
    porCtg.set(ctg, viaje);
    resultado.lineas.push(viaje);
  }

  // El primer "Sub-Total" es el neto gravado; el segundo repite el valor.
  const neto = texto.match(new RegExp(String.raw`Sub-Total\s+(${IMPORTE_AR})`));
  if (neto) resultado.neto_gravado = numeroAr(neto[1]);
  const iva = texto.match(new RegExp(String.raw`IVA Insc\s+[\d,]+\s+(${IMPORTE_AR})`));
  if (iva) resultado.iva = numeroAr(iva[1]);
  const total = texto.match(new RegExp(String.raw`\bTOTAL\s+(${IMPORTE_AR})`));
  if (total) resultado.total = numeroAr(total[1]);

  return resultado;
}

/** Prueba los formatos conocidos; devuelve el primero que encuentre viajes. */
export function parseTextoLiquidoProducto(texto: string): LpExtraido {
  const softRaices = parseTextoLp(texto);
  if (softRaices.lineas.length > 0) return softRaices;
  return parseTextoCvlp(texto);
}

/** Neto de una línea: el flete menos lo que el cliente descontó. */
export function netoLinea(l: LineaLp): number {
  return l.total - l.comision - l.otros_descuentos;
}
