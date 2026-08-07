import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import {
  clientes,
  condicionesPago,
  estacionesServicio,
  lugares,
  lugaresAlias,
  mediosPago,
  productos,
  tiposAdicional,
  tiposContingencia,
  tiposGasto,
} from "@/db/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabCondicionesPago } from "./_tabs/condiciones-pago";
import { TabMediosPago } from "./_tabs/medios-pago";
import { TabTiposAdicional } from "./_tabs/tipos-adicional";
import { TabTiposGasto } from "./_tabs/tipos-gasto";
import { TabTiposContingencia } from "./_tabs/tipos-contingencia";
import { TabEstacionesServicio } from "./_tabs/estaciones-servicio";
import { TabProductos } from "./_tabs/productos";
import { TabLugares } from "./_tabs/lugares";

export const metadata: Metadata = {
  title: "Configuración — Gestión de Fletes",
};

export default async function ConfiguracionPage() {
  const [
    filasCondicionesPago,
    filasMediosPago,
    filasTiposAdicional,
    filasTiposGasto,
    filasTiposContingencia,
    filasEstacionesServicio,
    filasProductos,
    filasLugares,
    filasAlias,
    filasClientes,
  ] = await Promise.all([
    db.select().from(condicionesPago).orderBy(asc(condicionesPago.nombre)),
    db.select().from(mediosPago).orderBy(asc(mediosPago.nombre)),
    db.select().from(tiposAdicional).orderBy(asc(tiposAdicional.nombre)),
    db.select().from(tiposGasto).orderBy(asc(tiposGasto.nombre)),
    db.select().from(tiposContingencia).orderBy(asc(tiposContingencia.nombre)),
    db.select().from(estacionesServicio).orderBy(asc(estacionesServicio.nombre)),
    db.select().from(productos).orderBy(asc(productos.nombre)),
    db.select().from(lugares).orderBy(asc(lugares.nombre)),
    db.select().from(lugaresAlias),
    db
      .select({ id: clientes.id, razon_social: clientes.razon_social })
      .from(clientes)
      .orderBy(asc(clientes.razon_social)),
  ]);

  const aliasPorLugar = new Map<number, string[]>();
  for (const a of filasAlias) {
    const lista = aliasPorLugar.get(a.lugar_id) ?? [];
    lista.push(a.alias);
    aliasPorLugar.set(a.lugar_id, lista);
  }
  const lugaresConAlias = filasLugares.map((l) => ({
    ...l,
    aliases: aliasPorLugar.get(l.id) ?? [],
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Configuración</h1>

      <Tabs defaultValue="productos">
        <TabsList className="flex-wrap">
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="lugares">Lugares</TabsTrigger>
          <TabsTrigger value="estaciones">Estaciones de servicio</TabsTrigger>
          <TabsTrigger value="condiciones-pago">Condiciones de pago</TabsTrigger>
          <TabsTrigger value="medios-pago">Medios de pago</TabsTrigger>
          <TabsTrigger value="tipos-adicional">Tipos de adicional</TabsTrigger>
          <TabsTrigger value="tipos-gasto">Tipos de gasto</TabsTrigger>
          <TabsTrigger value="tipos-contingencia">Tipos de contingencia</TabsTrigger>
        </TabsList>

        <TabsContent value="productos">
          <TabProductos filas={filasProductos} />
        </TabsContent>
        <TabsContent value="lugares">
          <TabLugares filas={lugaresConAlias} clientes={filasClientes} />
        </TabsContent>
        <TabsContent value="estaciones">
          <TabEstacionesServicio filas={filasEstacionesServicio} />
        </TabsContent>
        <TabsContent value="condiciones-pago">
          <TabCondicionesPago filas={filasCondicionesPago} />
        </TabsContent>
        <TabsContent value="medios-pago">
          <TabMediosPago filas={filasMediosPago} />
        </TabsContent>
        <TabsContent value="tipos-adicional">
          <TabTiposAdicional filas={filasTiposAdicional} />
        </TabsContent>
        <TabsContent value="tipos-gasto">
          <TabTiposGasto filas={filasTiposGasto} />
        </TabsContent>
        <TabsContent value="tipos-contingencia">
          <TabTiposContingencia filas={filasTiposContingencia} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
