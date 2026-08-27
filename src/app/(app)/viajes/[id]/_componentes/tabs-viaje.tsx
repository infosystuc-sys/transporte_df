"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormularioDatosGenerales } from "../../_componentes/formulario-datos-generales";
import { TabCarga } from "../../_componentes/tab-carga";
import { TabDescarga } from "../../_componentes/tab-descarga";
import { TabTarifa } from "../../_componentes/tab-tarifa";
import { TabContingencias } from "../../_componentes/tab-contingencias";
import { TabGastos } from "../../_componentes/tab-gastos";
import { TabFacturacion } from "../../_componentes/tab-facturacion";
import { TabAdjuntos } from "./tab-adjuntos";
import { TabLiquidacion } from "./tab-liquidacion";
import type { ComponentProps } from "react";

export function TabsViaje({
  datosGenerales,
  carga,
  descarga,
  tarifa,
  gastos,
  facturacion,
  contingencias,
  adjuntos,
  liquidacion,
}: {
  datosGenerales: ComponentProps<typeof FormularioDatosGenerales>;
  carga: ComponentProps<typeof TabCarga>;
  descarga: ComponentProps<typeof TabDescarga>;
  tarifa: ComponentProps<typeof TabTarifa>;
  gastos: ComponentProps<typeof TabGastos>;
  facturacion: ComponentProps<typeof TabFacturacion>;
  contingencias: ComponentProps<typeof TabContingencias>;
  adjuntos: ComponentProps<typeof TabAdjuntos>;
  liquidacion: ComponentProps<typeof TabLiquidacion>;
}) {
  return (
    <Tabs defaultValue="generales">
      {/* overflow-x-auto en vez de flex-wrap: con la altura fija (h-8) de
          TabsList, envolver a varias filas en mobile hacía que el
          sobrante quedara flotando encima del contenido de abajo.
          min-w-0: TabsList es un item flex dentro de Tabs (flex-col) -- sin
          esto, el ancho mínimo automático de sus 9 triggers (flex-1) empuja
          el ancho de TabsList por encima del viewport en vez de scrollear,
          y en mobile terminaba agrandando la página entera (no solo la
          lista de pestañas). */}
      <TabsList className="w-full min-w-0 justify-start overflow-x-auto">
        <TabsTrigger value="generales">Datos generales</TabsTrigger>
        <TabsTrigger value="carga">Carga</TabsTrigger>
        <TabsTrigger value="descarga">Descarga y merma</TabsTrigger>
        <TabsTrigger value="tarifa">Tarifa e importes</TabsTrigger>
        <TabsTrigger value="gastos">Gastos y gasoil</TabsTrigger>
        <TabsTrigger value="facturacion">Facturación y cobro</TabsTrigger>
        <TabsTrigger value="liquidacion">Liquidación</TabsTrigger>
        <TabsTrigger value="contingencias">Contingencias</TabsTrigger>
        <TabsTrigger value="adjuntos">Adjuntos</TabsTrigger>
      </TabsList>
      <TabsContent value="generales">
        <FormularioDatosGenerales {...datosGenerales} />
      </TabsContent>
      <TabsContent value="carga">
        <TabCarga {...carga} />
      </TabsContent>
      <TabsContent value="descarga">
        <TabDescarga {...descarga} />
      </TabsContent>
      <TabsContent value="tarifa">
        <TabTarifa {...tarifa} />
      </TabsContent>
      <TabsContent value="gastos">
        <TabGastos {...gastos} />
      </TabsContent>
      <TabsContent value="facturacion">
        <TabFacturacion {...facturacion} />
      </TabsContent>
      <TabsContent value="liquidacion">
        <TabLiquidacion {...liquidacion} />
      </TabsContent>
      <TabsContent value="contingencias">
        <TabContingencias {...contingencias} />
      </TabsContent>
      <TabsContent value="adjuntos">
        <TabAdjuntos {...adjuntos} />
      </TabsContent>
    </Tabs>
  );
}
