"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampoPeso, CampoTexto } from "@/components/catalogos/campos-formulario";
import { viajeCargaSchema, type ViajeCargaInput } from "@/lib/schemas/viajes";
import { actualizarCarga } from "../actions";

export function TabCarga({
  viajeId,
  valoresIniciales,
}: {
  viajeId: number;
  valoresIniciales: ViajeCargaInput;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ViajeCargaInput>({
    resolver: zodResolver(viajeCargaSchema),
    defaultValues: valoresIniciales,
  });

  const bruto = form.watch("bruto_origen");
  const tara = form.watch("tara_origen");

  useEffect(() => {
    const netoActual = form.getValues("neto_origen");
    if (netoActual) return; // no pisar un valor ya cargado/editado a mano
    const b = bruto ? Number(bruto) : undefined;
    const t = tara ? Number(tara) : undefined;
    if (b !== undefined && t !== undefined && !Number.isNaN(b) && !Number.isNaN(t)) {
      form.setValue("neto_origen", String(b - t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bruto, tara]);

  function onSubmit(valores: ViajeCargaInput) {
    startTransition(async () => {
      const resultado = await actualizarCarga(viajeId, valores);
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
        <CampoTexto form={form} name="fecha_carga" label="Fecha de carga" tipo="date" />
        <CampoTexto form={form} name="fecha_partida" label="Fecha de partida" tipo="date" />
        <CampoPeso form={form} name="bruto_origen" label="Peso bruto (origen)" />
        <CampoPeso form={form} name="tara_origen" label="Tara (origen)" />
        <CampoPeso form={form} name="neto_origen" label="Peso neto (origen)" />
      </div>
      <p className="text-xs text-muted-foreground">
        El neto se calcula solo al cargar bruto y tara, si todavía no lo escribiste a mano. Siempre
        podés editarlo directamente.
      </p>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
