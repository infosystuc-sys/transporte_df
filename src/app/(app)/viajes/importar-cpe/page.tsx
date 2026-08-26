import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, configuracion, lugares, productos } from "@/db/schema";
import { FormularioRevisionCpe } from "./_componentes/formulario-revision-cpe";

export const metadata: Metadata = {
  title: "Importar CPE — Gestión de Fletes",
};

export default async function ImportarCpePage() {
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
  const configDefaults = filaConfig[0] ?? {
    base_calculo_flete_default: null,
    modalidad_tarifa_default: null,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar CPE</h1>
        <p className="text-sm text-muted-foreground">
          Subí el PDF o una foto de la Carta de Porte Electrónica: el sistema intenta completar los
          datos del viaje automáticamente, pero siempre revisás y confirmás antes de guardar nada.
        </p>
      </div>
      <FormularioRevisionCpe
        clientes={filasClientes}
        camiones={filasCamiones}
        choferes={filasChoferes}
        productos={filasProductos}
        lugares={filasLugares}
        configDefaults={configDefaults}
      />
    </div>
  );
}
