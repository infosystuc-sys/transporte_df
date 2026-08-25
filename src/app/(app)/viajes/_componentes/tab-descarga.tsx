"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CampoPeso, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BotonCargarIADescarga } from "@/lib/comprobantes/boton-cargar-ia-descarga";
import { viajeDescargaSchema, type ViajeDescargaInput } from "@/lib/schemas/viajes";
import { actualizarDescarga, actualizarDescargaConAdjunto } from "../actions";

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

  // El archivo del ticket de balanza se guarda acá (no en el form) hasta
  // el submit final -- recién se sube y se adjunta al viaje cuando el
  // usuario confirma los datos precargados, no en el momento en que se
  // procesa por IA (mismo patrón que gasoil).
  const [archivoIA, setArchivoIA] = useState<File | null>(null);

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
      let resultado;
      if (archivoIA) {
        const formData = new FormData();
        formData.set("archivo", archivoIA);
        formData.set("datos", JSON.stringify(valores));
        resultado = await actualizarDescargaConAdjunto(viajeId, formData);
      } else {
        resultado = await actualizarDescarga(viajeId, valores);
      }
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      setArchivoIA(null);
      toast.success("Guardado.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BotonCargarIADescarga
          onExtraido={(archivo, datos) => {
            setArchivoIA(archivo);
            form.reset({
              ...form.getValues(),
              fecha_arribo: (datos.fecha_arribo ?? form.getValues("fecha_arribo")) as unknown as Date,
              fecha_descarga: (datos.fecha_descarga ??
                form.getValues("fecha_descarga")) as unknown as Date,
              n_turno_descarga: datos.n_turno_descarga ?? form.getValues("n_turno_descarga"),
              bruto_destino:
                datos.bruto_destino_kg != null
                  ? String(datos.bruto_destino_kg)
                  : form.getValues("bruto_destino"),
              tara_destino:
                datos.tara_destino_kg != null
                  ? String(datos.tara_destino_kg)
                  : form.getValues("tara_destino"),
              neto_destino:
                datos.neto_destino_kg != null
                  ? String(datos.neto_destino_kg)
                  : form.getValues("neto_destino"),
              humedad_pct:
                datos.humedad_pct != null ? String(datos.humedad_pct) : form.getValues("humedad_pct"),
            });
          }}
        />
        <p className="text-xs text-muted-foreground">
          Subí una foto o PDF del ticket de balanza y se completan los campos solos — revisalos
          antes de guardar.
        </p>
      </div>
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
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 [&>div]:min-w-0 [&_p]:break-words">
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
