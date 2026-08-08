import type { Metadata } from "next";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { clientes, lugares, productos, tarifas } from "@/db/schema";
import { GestorTarifas } from "./_componentes/gestor-tarifas";

export const metadata: Metadata = {
  title: "Tarifario — Gestión de Fletes",
};

export default async function TarifarioPage() {
  const [filasTarifas, filasClientes, filasLugares, filasProductos] = await Promise.all([
    db.select().from(tarifas).orderBy(desc(tarifas.vigencia_desde)),
    db
      .select({ id: clientes.id, nombre: clientes.razon_social })
      .from(clientes)
      .orderBy(asc(clientes.razon_social)),
    db.select({ id: lugares.id, nombre: lugares.nombre }).from(lugares).orderBy(asc(lugares.nombre)),
    db
      .select({ id: productos.id, nombre: productos.nombre })
      .from(productos)
      .orderBy(asc(productos.nombre)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Tarifario</h1>
      <GestorTarifas
        filas={filasTarifas}
        clientes={filasClientes}
        lugares={filasLugares}
        productos={filasProductos}
      />
    </div>
  );
}
