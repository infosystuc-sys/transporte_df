import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { clientes, condicionesPago } from "@/db/schema";
import { GestorClientes } from "./_componentes/gestor-clientes";

export const metadata: Metadata = {
  title: "Clientes — Gestión de Fletes",
};

export default async function ClientesPage() {
  const [filasClientes, filasCondicionesPago] = await Promise.all([
    db.select().from(clientes).orderBy(asc(clientes.razon_social)),
    db.select().from(condicionesPago).orderBy(asc(condicionesPago.nombre)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Clientes</h1>
      <GestorClientes filas={filasClientes} condicionesPago={filasCondicionesPago} />
    </div>
  );
}
