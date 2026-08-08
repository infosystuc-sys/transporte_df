import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, lugares, productos } from "@/db/schema";
import { FormularioImportacionHistorica } from "./_componentes/formulario-importacion-historica";

export const metadata: Metadata = {
  title: "Importar histórico — Gestión de Fletes",
};

export default async function ImportarHistoricoPage() {
  const [filasClientes, filasCamiones, filasChoferes, filasProductos, filasLugares] =
    await Promise.all([
      db
        .select({ id: clientes.id, nombre: clientes.razon_social })
        .from(clientes)
        .orderBy(asc(clientes.razon_social)),
      db
        .select({ id: camiones.id, nombre: camiones.dominio_tractor })
        .from(camiones)
        .orderBy(asc(camiones.dominio_tractor)),
      db
        .select({ id: choferes.id, nombre: choferes.nombre_completo })
        .from(choferes)
        .orderBy(asc(choferes.nombre_completo)),
      db.select({ id: productos.id, nombre: productos.nombre }).from(productos).orderBy(asc(productos.nombre)),
      db.select({ id: lugares.id, nombre: lugares.nombre }).from(lugares).orderBy(asc(lugares.nombre)),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar histórico desde Excel</h1>
        <p className="text-sm text-muted-foreground">
          Subí la planilla anual (una hoja por tipo de carga). Revisá y confirmá antes de guardar —
          nada se importa automáticamente.
        </p>
      </div>
      <FormularioImportacionHistorica
        clientes={filasClientes}
        camiones={filasCamiones}
        choferes={filasChoferes}
        productos={filasProductos}
        lugares={filasLugares}
      />
    </div>
  );
}
