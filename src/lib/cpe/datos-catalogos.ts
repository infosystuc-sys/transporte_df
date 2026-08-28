import { asc } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, configuracion, lugares, productos } from "@/db/schema";
import type { BaseCalculo, ModalidadTarifa } from "@/lib/tarifa-defaults";

export type CatalogosImportacionCpe = {
  clientes: {
    id: number;
    nombre: string;
    cuit: string | null;
    base_calculo_flete: BaseCalculo | "heredar" | null;
  }[];
  camiones: { id: number; dominio_tractor: string; dominio_acoplado: string | null }[];
  choferes: { id: number; nombre: string; cuil: string | null }[];
  productos: { id: number; nombre: string }[];
  lugares: { id: number; nombre: string }[];
  configDefaults: {
    base_calculo_flete_default: BaseCalculo | null;
    modalidad_tarifa_default: ModalidadTarifa | null;
  };
};

/**
 * Catálogos que necesita la pantalla de revisión de CPE (una sola o en
 * tanda) para poblar los selects y resolver la cascada de tarifa. Extraído
 * de importar-cpe/page.tsx para que la pantalla de tanda (importar-cpe-
 * masivo) no repita la misma consulta.
 */
export async function obtenerCatalogosImportacionCpe(): Promise<CatalogosImportacionCpe> {
  const [filasClientes, filasCamiones, filasChoferes, filasProductos, filasLugares, filaConfig] =
    await Promise.all([
      db
        .select({
          id: clientes.id,
          nombre: clientes.razon_social,
          cuit: clientes.cuit,
          base_calculo_flete: clientes.base_calculo_flete,
        })
        .from(clientes)
        .orderBy(asc(clientes.razon_social)),
      db
        .select({
          id: camiones.id,
          dominio_tractor: camiones.dominio_tractor,
          dominio_acoplado: camiones.dominio_acoplado,
        })
        .from(camiones)
        .orderBy(asc(camiones.dominio_tractor)),
      db
        .select({ id: choferes.id, nombre: choferes.nombre_completo, cuil: choferes.cuil })
        .from(choferes)
        .orderBy(asc(choferes.nombre_completo)),
      db.select({ id: productos.id, nombre: productos.nombre }).from(productos).orderBy(asc(productos.nombre)),
      db.select({ id: lugares.id, nombre: lugares.nombre }).from(lugares).orderBy(asc(lugares.nombre)),
      db
        .select({
          base_calculo_flete_default: configuracion.base_calculo_flete_default,
          modalidad_tarifa_default: configuracion.modalidad_tarifa_default,
        })
        .from(configuracion)
        .limit(1),
    ]);

  return {
    clientes: filasClientes,
    camiones: filasCamiones,
    choferes: filasChoferes,
    productos: filasProductos,
    lugares: filasLugares,
    configDefaults: filaConfig[0] ?? {
      base_calculo_flete_default: null,
      modalidad_tarifa_default: null,
    },
  };
}
