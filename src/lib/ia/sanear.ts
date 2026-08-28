// Placeholders que Claude a veces devuelve en vez de null cuando el campo
// pedido no está en el documento (a pesar del prompt pidiendo null
// explícitamente) -- sin limpiarlos, un campo "no leído" se ve como un dato
// real: rompe el aviso de "revisá con cuidado", el matching contra
// catálogos (busca un cliente/chofer literal llamado "unknown") y el panel
// de "faltan dar de alta" (ofrecería crear una ficha con ese nombre).
const PLACEHOLDERS_IA = new Set([
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "desconocido",
  "no disponible",
  "no aplica",
  "sin dato",
  "sin datos",
  "-",
  "--",
]);

export function limpiarTextoIA(valor: string | null | undefined): string | null {
  if (valor == null) return null;
  const normalizado = valor.trim();
  if (normalizado === "" || PLACEHOLDERS_IA.has(normalizado.toLowerCase())) return null;
  return normalizado;
}

/** Aplica limpiarTextoIA a los campos de texto indicados de un objeto extraído por IA. */
export function limpiarCamposTexto<T extends Record<string, unknown>>(
  obj: T,
  camposTexto: readonly (keyof T)[]
): T {
  const limpio = { ...obj };
  for (const campo of camposTexto) {
    const valor = limpio[campo];
    if (typeof valor === "string" || valor === null) {
      limpio[campo] = limpiarTextoIA(valor as string | null) as T[keyof T];
    }
  }
  return limpio;
}
