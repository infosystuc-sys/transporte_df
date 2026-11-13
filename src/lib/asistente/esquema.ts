import { getTableName, type Table } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { COLUMNAS_EMPLEADO, type RolFelix } from "./permisos";

/**
 * Tablas que Félix puede consultar: las mismas que habilita la migración
 * 0016 para el rol asistente_lectura (sin usuarios ni adjuntos), más su
 * propio registro (0018). Un empleado ve menos: COLUMNAS_EMPLEADO.
 */
export const TABLAS_ASISTENTE = [
  "viajes", "viaje_adicionales", "viaje_gastos", "viaje_contingencias",
  "clientes", "choferes", "camiones", "lugares", "lugares_alias", "productos",
  "tarifas", "condiciones_pago", "medios_pago", "tipos_adicional", "tipos_gasto",
  "tipos_contingencia", "estaciones_servicio", "cargas_gasoil",
  "movimientos_chofer", "liquidaciones_chofer", "liquidacion_viajes",
  "cobros", "cobro_imputaciones", "retenciones_cobro",
  "liquidos_producto", "liquido_producto_lineas", "liquido_producto_cobros",
  "asistente_registro",
] as const;

function esTabla(v: unknown): v is PgTable {
  try {
    return typeof v === "object" && v !== null && typeof getTableName(v as Table) === "string";
  } catch {
    return false;
  }
}

/**
 * Describe las tablas permitidas a partir del esquema de Drizzle: así lo
 * que sabe Félix sigue al código cuando se agregan columnas, sin mantener
 * una copia a mano. Una línea por columna: nombre, tipo, valores posibles
 * (enums) y a qué tabla apunta (FK).
 */
export function describirEsquema(rol: RolFelix = "admin"): string {
  const permitidas = new Set<string>(rol === "admin" ? TABLAS_ASISTENTE : Object.keys(COLUMNAS_EMPLEADO));
  const bloques: string[] = [];
  for (const valor of Object.values(schema)) {
    if (!esTabla(valor)) continue;
    const config = getTableConfig(valor);
    if (!permitidas.has(config.name)) continue;

    const fks = new Map<string, string>();
    for (const fk of config.foreignKeys) {
      const ref = fk.reference();
      ref.columns.forEach((col, i) => {
        fks.set(col.name, `${getTableName(ref.foreignTable)}.${ref.foreignColumns[i]?.name}`);
      });
    }

    const visibles = rol === "admin" ? "*" : COLUMNAS_EMPLEADO[config.name];
    const columnas = config.columns
      .filter((c) => visibles === "*" || visibles?.includes(c.name))
      .map((c) => {
      const partes = [`${c.name} ${c.getSQLType()}`];
      const valores = (c as { enumValues?: readonly string[] }).enumValues;
      if (valores?.length) partes.push(`(${valores.join(" | ")})`);
      if (fks.has(c.name)) partes.push(`-> ${fks.get(c.name)}`);
      return `  ${partes.join(" ")}`;
    });
    bloques.push(`${config.name}\n${columnas.join("\n")}`);
  }
  return bloques.sort().join("\n\n");
}
