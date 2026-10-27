import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { clientes, condicionesPago } from "@/db/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GestorClientes } from "./_componentes/gestor-clientes";
import { TablaComisiones } from "./_componentes/tabla-comisiones";

export const metadata: Metadata = {
  title: "Clientes — Gestión de Fletes",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const [filasClientes, filasCondicionesPago] = await Promise.all([
    db.select().from(clientes).orderBy(asc(clientes.razon_social)),
    db.select().from(condicionesPago).orderBy(asc(condicionesPago.nombre)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-black tracking-[-0.01em]">Clientes</h1>
      {/* ?tab=comisiones: los avisos de la importación de CPE linkean directo acá. */}
      <Tabs defaultValue={tab === "comisiones" ? "comisiones" : "clientes"}>
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes">
          <GestorClientes filas={filasClientes} condicionesPago={filasCondicionesPago} />
        </TabsContent>
        <TabsContent value="comisiones">
          <TablaComisiones filas={filasClientes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
