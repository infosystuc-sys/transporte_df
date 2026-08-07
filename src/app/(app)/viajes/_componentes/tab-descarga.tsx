"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampoPeso, CampoTexto } from "@/components/catalogos/campos-formulario";
import { viajeDescargaSchema, type ViajeDescargaInput } from "@/lib/schemas/viajes";
import { actualizarDescarga } from "../actions";

export function TabDescarga({
  viajeId,
  valoresIniciales,
}: {
  viajeId: number;
  valoresIniciales: ViajeDescargaInput;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ViajeDescargaInput>({
    resolver: zodResolver(viajeDescargaSchema),
    defaultValues: valoresIniciales,
  });

  const bruto = form.watch("bruto_destino");
  const tara = form.watch("tara_destino");

  useEffect(() => {
    const netoActual = form.getValues("neto_destino");
    if (netoActual) return;
    const b = bruto ? Number(bruto) : undefined;
    const t = tara ? Number(tara) : undefined;
    if (b !== undefined && t !== undefined && !Number.isNaN(b) && !Number.isNaN(t)) {
      form.setValue("neto_destino", String(b - t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bruto, tara]);

  function onSubmit(valores: ViajeDescargaInput) {
    startTransition(async () => {
      const resultado = await actualizarDescarga(viajeId, valores);
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
        <CampoTexto form={form} name="fecha_arribo" label="Fecha de arribo" tipo="date" />
        <CampoTexto form={form} name="fecha_descarga" label="Fecha de descarga" tipo="date" />
        <CampoTexto form={form} name="n_turno_descarga" label="N° de turno" />
        <CampoPeso form={form} name="bruto_destino" label="Peso bruto (destino)" />
        <CampoPeso form={form} name="tara_destino" label="Tara (destino)" />
        <CampoPeso form={form} name="neto_destino" label="Peso neto (destino)" />
      </div>
      <p className="text-xs text-muted-foreground">
        El cálculo de merma y la alerta por tolerancia se agregan en la Fase 6.
      </p>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
