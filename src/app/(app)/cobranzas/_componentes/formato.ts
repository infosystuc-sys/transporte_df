export const pesos = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

/** "2026-09-30" → "30/09/2026". */
export const fecha = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
