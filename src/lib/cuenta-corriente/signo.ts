/**
 * Signo de cada tipo de movimiento sobre el saldo a favor del chofer
 * (spec 3.6): adelanto y ajuste negativo restan; liquidacion y
 * gasto_rendido suman. "gasoil" queda reservado para cuando la empresa le
 * entrega gasoil al chofer a cuenta (resta) — el gasoil que el chofer paga
 * de su bolsillo se registra como gasto_rendido, no como "gasoil".
 *
 * Sin dependencias de servidor a propósito: lo usan tanto Server
 * Components/Actions como componentes cliente (ej. para mostrar el saldo).
 */
export function signoTipoMovimiento(tipo: string): 1 | -1 {
  switch (tipo) {
    case "liquidacion":
    case "gasto_rendido":
      return 1;
    case "adelanto":
    case "gasoil":
    case "devolucion":
    case "ajuste":
    default:
      return -1;
  }
}

/** Saldo a favor del chofer (positivo = la empresa le debe). */
export function calcularSaldo(movimientos: { tipo: string; importe: string }[]) {
  return movimientos.reduce(
    (saldo, m) => saldo + signoTipoMovimiento(m.tipo) * Number(m.importe),
    0
  );
}
