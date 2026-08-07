"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { configuracionSchema, type ConfiguracionInput } from "@/lib/schemas/configuracion";
import { actualizarConfiguracion } from "../actions";

const opcionesBaseCalculo = [
  { value: "origen", label: "Origen" },
  { value: "destino", label: "Destino" },
];
const opcionesModalidad = [
  { value: "por_tonelada", label: "Por tonelada" },
  { value: "por_km", label: "Por km" },
  { value: "por_tonelada_km", label: "Por tonelada-km" },
  { value: "monto_fijo", label: "Monto fijo" },
];
const opcionesUnidad = [
  { value: "toneladas", label: "Toneladas" },
  { value: "kilogramos", label: "Kilogramos" },
];

export function TabGeneral({ id, valoresIniciales }: { id: number; valoresIniciales: ConfiguracionInput }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ConfiguracionInput>({
    resolver: zodResolver(configuracionSchema),
    defaultValues: valoresIniciales,
  });

  function onSubmit(valores: ConfiguracionInput) {
    startTransition(async () => {
      await actualizarConfiguracion(id, valores);
      toast.success("Configuración guardada.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Datos de la empresa</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoTexto form={form} name="razon_social" label="Razón social" />
          <CampoTexto form={form} name="cuit" label="CUIT" />
          <CampoTexto form={form} name="direccion" label="Dirección" />
          <CampoTexto form={form} name="telefono" label="Teléfono" />
          <CampoTexto form={form} name="email" label="Email" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Valores por defecto</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoTexto form={form} name="tolerancia_merma_pct" label="Tolerancia de merma (%)" />
          <CampoSelect
            form={form}
            name="base_calculo_flete_default"
            label="Base de cálculo del flete"
            opciones={opcionesBaseCalculo}
          />
          <CampoSelect
            form={form}
            name="modalidad_tarifa_default"
            label="Modalidad de tarifa"
            opciones={opcionesModalidad}
          />
          <CampoSelect
            form={form}
            name="unidad_carga_default"
            label="Unidad de carga"
            opciones={opcionesUnidad}
          />
          <CampoTexto form={form} name="porcentaje_chofer_default" label="% del chofer por defecto" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Alertas del dashboard</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoTexto
            form={form}
            name="alerta_ctg_horas"
            label="Avisar CTG por vencer con (horas de anticipación)"
            tipo="number"
          />
          <CampoTexto
            form={form}
            name="alerta_vencimientos_dias"
            label="Avisar vencimientos de flota/choferes con (días de anticipación)"
            tipo="number"
          />
        </div>
      </div>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
