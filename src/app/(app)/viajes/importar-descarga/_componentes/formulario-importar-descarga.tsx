"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { viajeDescargaSchema, type ViajeDescargaInput } from "@/lib/schemas/viajes";
import type { ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import type { ViajeEncontradoPorCtg } from "../../_lib/buscar-ctg";
import { actualizarDescargaConAdjunto } from "../../actions";
import { previsualizarImportacionDescarga } from "../actions";
import {
  CamposRevisionDescarga,
  construirValoresDescarga,
  PickerViajesEncontrados,
} from "./campos-revision-descarga";

const valoresPorDefecto: ViajeDescargaInput = {
  fecha_arribo: undefined,
  fecha_descarga: undefined,
  n_turno_descarga: "",
  bruto_destino: "",
  tara_destino: "",
  neto_destino: "",
  humedad_pct: "",
  merma_precio_unitario: "",
};

export function FormularioImportarDescarga() {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [isPendingProcesar, startTransitionProcesar] = useTransition();
  const [isPendingGuardar, startTransitionGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ctgBuscado, setCtgBuscado] = useState<string | null>(null);
  const [viajesEncontrados, setViajesEncontrados] = useState<ViajeEncontradoPorCtg[] | null>(null);
  const [datosExtraidos, setDatosExtraidos] = useState<ComprobanteDescargaExtraido | null>(null);
  const [viajeElegido, setViajeElegido] = useState<ViajeEncontradoPorCtg | null>(null);
  const [confirmaSobrescribir, setConfirmaSobrescribir] = useState(false);

  const form = useForm<ViajeDescargaInput>({
    resolver: zodResolver(viajeDescargaSchema),
    defaultValues: valoresPorDefecto,
  });

  function onSeleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    setArchivo(e.target.files?.[0] ?? null);
    setError(null);
    setViajesEncontrados(null);
    setDatosExtraidos(null);
    setViajeElegido(null);
  }

  function procesar() {
    if (!archivo) return;
    setError(null);
    setViajesEncontrados(null);
    setDatosExtraidos(null);
    setViajeElegido(null);
    startTransitionProcesar(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const resultado = await previsualizarImportacionDescarga(formData);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setCtgBuscado(resultado.datos.ctg);
      setViajesEncontrados(resultado.viajes);
      setDatosExtraidos(resultado.datos);
      if (resultado.viajes.length === 0) {
        setError(`No se encontró ningún viaje cargado con el CTG ${resultado.datos.ctg}.`);
        return;
      }
      if (resultado.viajes.length === 1) {
        elegirViaje(resultado.viajes[0], resultado.datos);
      }
    });
  }

  function elegirViaje(viaje: ViajeEncontradoPorCtg, datos: ComprobanteDescargaExtraido) {
    setViajeElegido(viaje);
    setConfirmaSobrescribir(false);
    form.reset(construirValoresDescarga(datos));
  }

  const yaTieneDescarga = !!viajeElegido?.fecha_descarga;

  function onSubmit(valores: ViajeDescargaInput) {
    if (!viajeElegido || !archivo) return;
    if (yaTieneDescarga && !confirmaSobrescribir) {
      toast.error("Confirmá el checkbox de sobrescritura antes de guardar.");
      return;
    }
    startTransitionGuardar(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      formData.set("datos", JSON.stringify(valores));
      const resultado = await actualizarDescargaConAdjunto(viajeElegido.id, formData);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Descarga cargada.");
      router.push(`/viajes/${viajeElegido.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivo-descarga">Ticket de balanza o nota de recepción</Label>
          <Input
            id="archivo-descarga"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            onChange={onSeleccionarArchivo}
          />
        </div>
        <div>
          <Button onClick={procesar} disabled={!archivo || isPendingProcesar}>
            {isPendingProcesar ? "Leyendo..." : "Buscar viaje por CTG"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>No se pudo continuar</AlertTitle>
          <AlertDescription>
            {error}{" "}
            {ctgBuscado && (
              <>
                Buscá el viaje a mano en{" "}
                <Link href={`/viajes?q=${encodeURIComponent(ctgBuscado)}`} className="underline">
                  el listado de Viajes
                </Link>
                , o{" "}
                <Link href="/viajes" className="underline">
                  entrá directamente
                </Link>{" "}
                y cargá la descarga desde la pestaña correspondiente.
              </>
            )}
            {!ctgBuscado && (
              <>
                {" "}
                Podés cargar la descarga a mano desde{" "}
                <Link href="/viajes" className="underline">
                  el listado de Viajes
                </Link>
                .
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {viajesEncontrados && viajesEncontrados.length > 1 && !viajeElegido && (
        <PickerViajesEncontrados
          viajes={viajesEncontrados}
          ctgBuscado={ctgBuscado}
          onElegir={(v) => datosExtraidos && elegirViaje(v, datosExtraidos)}
        />
      )}

      {viajeElegido && datosExtraidos && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <CamposRevisionDescarga
            form={form}
            viaje={viajeElegido}
            datosExtraidos={datosExtraidos}
            confirmaSobrescribir={confirmaSobrescribir}
            onConfirmaSobrescribirChange={setConfirmaSobrescribir}
          />
          <div>
            <Button type="submit" disabled={isPendingGuardar || (yaTieneDescarga && !confirmaSobrescribir)}>
              {isPendingGuardar ? "Guardando..." : "Confirmar y cargar descarga"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
