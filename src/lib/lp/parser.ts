/**
 * Parser del "Líquido Producto" (comprobante ARCA cód. 060) que emiten los
 * clientes cuando le liquidan los fletes a la empresa, a partir del texto
 * plano que extrae unpdf. Los patrones salen de LP reales generados con
 * "Soft Raíces - Gestión para Transportistas" (según la empresa, todos los
 * que reciben tienen prácticamente el mismo formato). Si algún LP no
 * matchea, procesarLp cae a la lectura por IA.
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

/** Neto de una línea: el flete menos lo que el cliente descontó. */
export function netoLinea(l: LineaLp): number {
  return l.total - l.comision - l.otros_descuentos;
}
