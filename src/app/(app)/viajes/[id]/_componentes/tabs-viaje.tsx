"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormularioDatosGenerales } from "../../_componentes/formulario-datos-generales";
import { TabCarga } from "../../_componentes/tab-carga";
import { TabDescarga } from "../../_componentes/tab-descarga";
import { TabTarifa } from "../../_componentes/tab-tarifa";
import { TabContingencias } from "../../_componentes/tab-contingencias";
import { TabGastos } from "../../_componentes/tab-gastos";
import { TabFacturacion } from "../../_componentes/tab-facturacion";
import { TabPlaceholder } from "../../_componentes/tab-placeholder";
import type { ComponentProps } from "react";

export function TabsViaje({
  datosGenerales,
  carga,
  descarga,
  tarifa,
  gastos,
  facturacion,
  contingencias,
}: {
  datosGenerales: ComponentProps<typeof FormularioDatosGenerales>;
  carga: ComponentProps<typeof TabCarga>;
  descarga: ComponentProps<typeof TabDescarga>;
  tarifa: ComponentProps<typeof TabTarifa>;
  gastos: ComponentProps<typeof TabGastos>;
  facturacion: ComponentProps<typeof TabFacturacion>;
  contingencias: ComponentProps<typeof TabContingencias>;
}) {
  return (
    <Tabs defaultValue="generales">
      <TabsList className="flex-wrap">
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
        <TabPlaceholder fase="Fase 11 (Liquidaciones a choferes)" />
      </TabsContent>
      <TabsContent value="contingencias">
        <TabContingencias {...contingencias} />
      </TabsContent>
      <TabsContent value="adjuntos">
        <TabPlaceholder fase="Fase 10 (Importación de CPE, que introduce Supabase Storage)" />
      </TabsContent>
    </Tabs>
  );
}
