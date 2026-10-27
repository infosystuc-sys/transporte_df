import { ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, productos } from "@/db/schema";
import { buscarLugarPorNombre } from "@/lib/lugares/buscar";
import type { CpeExtraido } from "./parser";

export type Coincidencias = {
  /** Se busca por el CUIT del flete pagador: es el único que es cliente. */
  cliente_id: number | null;
  /** Cliente con el CUIT del campo "Intermediario de flete" de la CPE, si lo trae. */
  intermediario_id: number | null;
  chofer_id: number | null;
  camion_id: number | null;
  producto_id: number | null;
  origen_id: number | null;
  destino_id: number | null;
  /**
   * Choferes cuyo nombre se parece al de la CPE cuando su CUIL no matcheó
   * con ninguno (ver buscarChoferesParecidos). Con uno solo se asigna
   * igual (chofer_id) pero la pantalla de revisión avisa; con varios no se
   * asigna ninguno y se pide elegir a mano. Vacío si matcheó por CUIL.
   */
  choferes_parecidos: ChoferParecido[];
};

export type ChoferParecido = { id: number; nombre: string; cuil: string | null };

export type TipoEntidadFaltante = "cliente" | "chofer" | "camion" | "producto" | "lugar";

/** Campo del formulario de revisión que completa cada entidad al crearse. */
export type CampoViajeFaltante =
  | "cliente_id"
  | "chofer_id"
  | "camion_id"
  | "producto_id"
  | "origen_id"
  | "destino_id";

/** Dato que la CPE menciona pero que todavía no existe en los catálogos. */
export type EntidadFaltante = {
  /** Identificador estable del rol dentro de la CPE (ej. "cliente_titular"). */
  clave: string;
  tipo: TipoEntidadFaltante;
  campo: CampoViajeFaltante;
  etiqueta: string;
  nombre: string;
  /** CUIT/CUIL cuando el tipo lo tiene; null en el resto. */
  documento: string | null;
};

/**
 * Cruza lo extraído de la CPE contra lo que encontró el matching y lista
 * lo que habría que dar de alta. Es pura a propósito (no toca la base):
 * corre en el server dentro de procesarCpe, pero el tipo lo consume la
 * pantalla de revisión para mostrar el panel de confirmación.
 *
 * Un dato solo cuenta como faltante si la CPE efectivamente lo trae: si el
 * PDF no lo tenía, no hay nada que crear y el campo queda para cargar a
 * mano como siempre.
 */
export function detectarFaltantes(cpe: CpeExtraido, c: Coincidencias): EntidadFaltante[] {
  const faltantes: EntidadFaltante[] = [];

  const agregar = (
    encontrado: number | null,
    clave: string,
    tipo: TipoEntidadFaltante,
    campo: CampoViajeFaltante,
    etiqueta: string,
    nombre: string | null,
    documento: string | null = null
  ) => {
    if (encontrado != null) return;
    const limpio = nombre?.trim();
    if (!limpio) return;
    faltantes.push({
      clave,
      tipo,
      campo,
      etiqueta,
      nombre: limpio,
      documento: documento?.trim() || null,
    });
  };

  // Solo el flete pagador se da de alta como cliente: es a quien se le
  // factura. El titular de la carta de porte y el destinatario quedan
  // como texto estadístico en el viaje, sin ficha en el catálogo.
  agregar(c.cliente_id, "cliente", "cliente", "cliente_id", "Cliente (flete pagador)", cpe.pagador_nombre, cpe.pagador_cuit);
  // Con choferes parecidos no se ofrece crear uno nuevo: casi siempre es
  // la misma persona con el CUIL mal tipeado en la ficha o en la CPE, y
  // darlo de alta duplica al chofer (pasó con "PORTILLO" / "PORTILLO
  // CARLOS RUBEN"). Si de verdad es otro, queda el "+ Nuevo" del campo.
  if (c.choferes_parecidos.length === 0)
    agregar(c.chofer_id, "chofer", "chofer", "chofer_id", "Chofer", cpe.chofer_nombre, cpe.chofer_cuil);
  agregar(c.producto_id, "producto", "producto", "producto_id", "Producto (especie)", cpe.producto_nombre);
  agregar(c.camion_id, "camion", "camion", "camion_id", "Camión", cpe.dominio_tractor);
  agregar(c.origen_id, "origen", "lugar", "origen_id", "Origen", cpe.origen_localidad);
  agregar(c.destino_id, "destino", "lugar", "destino_id", "Destino", cpe.destino_localidad);

  return faltantes;
}

function limpiarCuit(cuit: string) {
  return cuit.replace(/[^0-9]/g, "");
}

/**
 * Compara una columna CUIT/CUIL contra un valor ya limpio (solo dígitos)
 * ignorando el formato con el que haya quedado guardada la columna (con
 * guiones, puntos, espacios). Sin esto, un chofer o cliente cargado a mano
 * con guiones ("20-12345678-3") nunca matchea contra el CUIL/CUIT que la
 * CPE trae limpio, y el importador crea un duplicado en vez de reusar la
 * ficha existente -- ese duplicado nace con los defaults (ej. 15% de
 * modalidad de pago) mientras la ficha original, si nunca se le configuró
 * ese dato, sigue sin liquidar viajes previos.
 */
export function cuitLimpioIgual(columna: typeof clientes.cuit | typeof choferes.cuil, valorLimpio: string) {
  return sql`regexp_replace(${columna}, '[^0-9]', '', 'g') = ${valorLimpio}`;
}

/** Palabras del nombre en mayúsculas, sin tildes ni signos ("Pórtillo, C." → ["PORTILLO"]). */
function palabrasNombre(nombre: string): string[] {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((p) => p.length >= 2);
}

/** Cantidad de dígitos distintos posición a posición; Infinity si difieren en largo. */
function digitosDistintos(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let distintos = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) distintos++;
  return distintos;
}

/**
 * Cuando el CUIL de la CPE no coincide con ningún chofer, busca fichas que
 * probablemente sean la misma persona:
 * - todas las palabras del nombre más corto están en el otro y son al
 *   menos dos ("CARLOS RUBEN PORTILLO" ~ "PORTILLO CARLOS RUBEN"), o
 * - comparten alguna palabra y el CUIL difiere en pocos dígitos (un
 *   error de tipeo: "PORTILLO" 20-28763086-8 ~ "PORTILLO CARLOS RUBEN"
 *   20-26783096-8).
 * Compartir solo el apellido no alcanza: dos hermanos o dos choferes que
 * se llaman igual de apellido son personas distintas.
 */
export function buscarChoferesParecidos(
  candidatos: ChoferParecido[],
  nombre: string | null,
  cuil: string | null
): ChoferParecido[] {
  const palabrasCpe = palabrasNombre(nombre ?? "");
  if (palabrasCpe.length === 0) return [];
  const cuilCpe = cuil ? limpiarCuit(cuil) : "";

  return candidatos.filter((c) => {
    const palabrasFicha = palabrasNombre(c.nombre);
    const enComun = palabrasCpe.filter((p) => palabrasFicha.includes(p)).length;
    if (enComun === 0) return false;

    const menor = Math.min(palabrasCpe.length, palabrasFicha.length);
    if (enComun === menor && menor >= 2) return true;

    const cuilFicha = c.cuil ? limpiarCuit(c.cuil) : "";
    return cuilCpe.length === 11 && digitosDistintos(cuilCpe, cuilFicha) <= 3;
  });
}

async function buscarClientePorCuit(cuit: string | null) {
  if (!cuit) return null;
  const [fila] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(cuitLimpioIgual(clientes.cuit, limpiarCuit(cuit)));
  return fila?.id ?? null;
}

export async function buscarCoincidencias(cpe: CpeExtraido): Promise<Coincidencias> {
  const [cliente_id, intermediario_id] = await Promise.all([
    buscarClientePorCuit(cpe.pagador_cuit),
    buscarClientePorCuit(cpe.intermediario_cuit),
  ]);

  const [chofer] = cpe.chofer_cuil
    ? await db
        .select({ id: choferes.id })
        .from(choferes)
        .where(cuitLimpioIgual(choferes.cuil, limpiarCuit(cpe.chofer_cuil)))
    : [];

  const choferes_parecidos =
    chofer || !cpe.chofer_nombre
      ? []
      : buscarChoferesParecidos(
          await db
            .select({ id: choferes.id, nombre: choferes.nombre_completo, cuil: choferes.cuil })
            .from(choferes),
          cpe.chofer_nombre,
          cpe.chofer_cuil
        );

  const [camion] = cpe.dominio_tractor
    ? await db
        .select({ id: camiones.id })
        .from(camiones)
        .where(ilike(camiones.dominio_tractor, cpe.dominio_tractor))
    : [];

  const [producto] = cpe.producto_nombre
    ? await db.select({ id: productos.id }).from(productos).where(ilike(productos.nombre, cpe.producto_nombre))
    : [];

  const [origen_id, destino_id] = await Promise.all([
    buscarLugarPorNombre(cpe.origen_localidad),
    buscarLugarPorNombre(cpe.destino_localidad),
  ]);

  return {
    cliente_id,
    intermediario_id,
    chofer_id: chofer?.id ?? (choferes_parecidos.length === 1 ? choferes_parecidos[0].id : null),
    choferes_parecidos,
    camion_id: camion?.id ?? null,
    producto_id: producto?.id ?? null,
    origen_id,
    destino_id,
  };
}
