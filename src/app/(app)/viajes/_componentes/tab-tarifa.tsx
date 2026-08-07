"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { viajeTarifaSchema, type ViajeTarifaInput } from "@/lib/schemas/viajes";
import { actualizarTarifa } from "../actions";

const opcionesModalidad = [
  { value: "por_tonelada", label: "Por tonelada" },
  { value: "por_km", label: "Por km" },
  { value: "por_tonelada_km", label: "Por tonelada-km" },
  { value: "monto_fijo", label: "Monto fijo" },
];
const opcionesBase = [
  { value: "origen", label: "Origen" },
  { value: "destino", label: "Destino" },
];

export function TabTarifa({
  viajeId,
  valoresIniciales,
}: {
  viajeId: number;
  valoresIniciales: ViajeTarifaInput;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ViajeTarifaInput>({
    resolver: zodResolver(viajeTarifaSchema),
    defaultValues: valoresIniciales,
  });

  function onSubmit(valores: ViajeTarifaInput) {
    startTransition(async () => {
      const resultado = await actualizarTarifa(viajeId, valores);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Guardado.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect form={form} name="modalidad_tarifa" label="Modalidad" opciones={opcionesModalidad} />
        <CampoTexto form={form} name="valor_tarifa" label="Valor de la tarifa ($)" />
        <CampoSelect form={form} name="base_calculo" label="Base de cálculo" opciones={opcionesBase} />
      </div>
      <p className="text-xs text-muted-foreground">
        El cálculo de importe_flete, adicionales, comisión y total a cobrar se agrega en la Fase 7.
      </p>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
