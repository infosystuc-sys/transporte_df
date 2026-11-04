/** Cómo informa el medio de pago el Cash Flow; el resto de los medios cuenta como "otro". */
export type MedioPagoCashflow = "echeq" | "transferencia" | "otro";

const normalizar = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/** Por nombre, porque los medios de pago son un catálogo editable en Configuración. */
export function clasificarMedioPago(nombre: string | null | undefined): MedioPagoCashflow {
  const n = normalizar(nombre ?? "");
  if (n === "echeq" || n === "echeque") return "echeq";
  if (n.startsWith("transferencia")) return "transferencia";
  return "otro";
}

export type CampoEcheq = "cheque_nro" | "banco" | "cheque_vto";

/**
 * Un eCheq sin número, banco emisor o fecha de cobro no le sirve al Cash
 * Flow (ni para identificarlo ni para proyectar cuándo entra la plata).
 */
export function camposFaltantesEcheq(cobro: {
  cheque_nro?: string | null;
  banco?: string | null;
  cheque_vto?: unknown;
}): { campo: CampoEcheq; mensaje: string }[] {
  const faltantes: { campo: CampoEcheq; mensaje: string }[] = [];
  if (!cobro.cheque_nro?.trim()) faltantes.push({ campo: "cheque_nro", mensaje: "Ingresá el número de eCheq." });
  if (!cobro.banco?.trim()) faltantes.push({ campo: "banco", mensaje: "Ingresá el banco emisor." });
  if (!cobro.cheque_vto) faltantes.push({ campo: "cheque_vto", mensaje: "Ingresá la fecha de cobro del eCheq." });
  return faltantes;
}
