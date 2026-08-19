"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CampoPeso, CampoTexto } from "@/components/catalogos/campos-formulario";
import { viajeDescargaSchema, type ViajeDescargaInput } from "@/lib/schemas/viajes";
import { actualizarDescarga } from "../actions";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export type MermaCalculada = {
  merma_kg: string | null;
  merma_pct: string | null;
  tolerancia_pct_aplicada: string | null;
  merma_excede_tolerancia: boolean;
  merma_importe: string | null;
};

export function TabDescarga({
  viajeId,
  valoresIniciales,
  merma,
}: {
  viajeId: number;
  valoresIniciales: ViajeDescargaInput;
  merma: MermaCalculada;
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
        <CampoTexto form={form} name="humedad_pct" label="Humedad (%)" />
      </div>

      {merma.merma_kg != null && merma.merma_pct != null ? (
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Merma</h3>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Merma</p>
              <p>{(Number(merma.merma_kg) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} tn</p>
            </div>
            <div>
              <p className="text-muted-foreground">% de merma</p>
              <p>{Number(merma.merma_pct).toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tolerancia aplicada</p>
              <p>{merma.tolerancia_pct_aplicada ? Number(merma.tolerancia_pct_aplicada).toFixed(2) : "—"}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Valorización</p>
              <p>{merma.merma_importe ? formatoARS.format(Number(merma.merma_importe)) : "—"}</p>
            </div>
          </div>
          {merma.merma_excede_tolerancia && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>La merma supera la tolerancia</AlertTitle>
              <AlertDescription>
                No bloquea el viaje ni descuenta nada automáticamente, es solo informativo.
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          La merma se calcula automáticamente cuando estén cargados el neto de origen y el de
          destino.
        </p>
      )}

      <CampoTexto
        form={form}
        name="merma_precio_unitario"
        label="Precio para valorizar la merma ($/tn, se precarga con el producto)"
      />

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
