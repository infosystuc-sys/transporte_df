import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import {
  clientes,
  condicionesPago,
  configuracion,
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
import { TabGeneral } from "./_tabs/general";

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
    filaConfiguracion,
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
    db.select().from(configuracion).limit(1),
  ]);
  const config = filaConfiguracion[0];

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
      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Configuración</h1>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="lugares">Lugares</TabsTrigger>
          <TabsTrigger value="estaciones">Estaciones de servicio</TabsTrigger>
          <TabsTrigger value="condiciones-pago">Condiciones de pago</TabsTrigger>
          <TabsTrigger value="medios-pago">Medios de pago</TabsTrigger>
          <TabsTrigger value="tipos-adicional">Tipos de adicional</TabsTrigger>
          <TabsTrigger value="tipos-gasto">Tipos de gasto</TabsTrigger>
          <TabsTrigger value="tipos-contingencia">Tipos de contingencia</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          {config && (
            <TabGeneral
              id={config.id}
              valoresIniciales={{
                razon_social: config.razon_social ?? "",
                cuit: config.cuit ?? "",
                direccion: config.direccion ?? "",
                telefono: config.telefono ?? "",
                email: config.email ?? "",
                tolerancia_merma_pct: config.tolerancia_merma_pct ?? undefined,
                base_calculo_flete_default: config.base_calculo_flete_default ?? undefined,
                modalidad_tarifa_default: config.modalidad_tarifa_default ?? undefined,
                unidad_carga_default: config.unidad_carga_default ?? undefined,
                porcentaje_chofer_default: config.porcentaje_chofer_default ?? undefined,
                alerta_ctg_horas: config.alerta_ctg_horas ?? undefined,
                alerta_vencimientos_dias: config.alerta_vencimientos_dias ?? undefined,
                alerta_diferencia_tarifa_pct: config.alerta_diferencia_tarifa_pct ?? undefined,
              }}
            />
          )}
        </TabsContent>
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
