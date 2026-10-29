import type { LineaLp } from "./parser";

/** Número con el que el LP queda en la facturación de cada viaje. */
export function nroFacturaLp(numero: string) {
  return `LP ${numero}`;
}

export type DiferenciaLp = { campo: string; lp: string; app: string };

type ViajeComparable = {
  neto_destino: string | null;
  valor_tarifa: string | null;
  importe_flete: string | null;
  comision_intermediario_pct: string | null;
};

const pesos = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const kilos = (n: number) => `${n.toLocaleString("es-AR")} kg`;
const pct = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 3 })}%`;

/**
 * Lo que el cliente liquidó distinto de lo que tiene cargado el viaje.
 * Los kilos se comparan contra el neto de destino: según la empresa, los
 * clientes liquidan siempre contra el peso de destino. Un dato que el
 * viaje todavía no tiene cargado también se marca, para que se vea que no
 * se pudo controlar.
 */
export function diferenciasLp(linea: LineaLp, comisionPctLp: number | null, viaje: ViajeComparable): DiferenciaLp[] {
  const difs: DiferenciaLp[] = [];
  const num = (v: string | null) => (v == null ? null : Number(v));

  const kg = num(viaje.neto_destino);
  if (linea.kg != null && kg !== linea.kg) {
    difs.push({ campo: "Kilos (neto destino)", lp: kilos(linea.kg), app: kg == null ? "sin cargar" : kilos(kg) });
  }

  const tarifa = num(viaje.valor_tarifa);
  if (linea.tarifa != null && (tarifa == null || Math.abs(tarifa - linea.tarifa) > 0.5)) {
    difs.push({ campo: "Tarifa", lp: pesos(linea.tarifa), app: tarifa == null ? "sin cargar" : pesos(tarifa) });
  }

  const flete = num(viaje.importe_flete);
  if (flete == null || Math.abs(flete - linea.total) > 1) {
    difs.push({ campo: "Flete", lp: pesos(linea.total), app: flete == null ? "sin calcular" : pesos(flete) });
  }

  const pctApp = num(viaje.comision_intermediario_pct);
  const pctLp = comisionPctLp ?? 0;
  if (Math.abs((pctApp ?? 0) - pctLp) > 0.01) {
    difs.push({ campo: "Comisión", lp: pct(pctLp), app: pctApp == null ? "sin comisión" : pct(pctApp) });
  }

  return difs;
}
