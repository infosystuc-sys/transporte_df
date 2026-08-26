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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CampoPeso, CampoTexto } from "@/components/catalogos/campos-formulario";
import { viajeDescargaSchema, type ViajeDescargaInput } from "@/lib/schemas/viajes";
import type { ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import type { ViajeEncontradoPorCtg } from "../../_lib/buscar-ctg";
import { actualizarDescargaConAdjunto } from "../../actions";
import { previsualizarImportacionDescarga } from "../actions";

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

const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

const ETIQUETAS_ESTADO: Record<string, string> = {
  planificado: "Planificado",
  cargado: "Cargado",
  en_transito: "En tránsito",
  descargado: "Descargado",
  facturado: "Facturado",
  cobrado: "Cobrado",
  liquidado: "Liquidado",
  rechazado: "Rechazado",
};

export function FormularioImportarDescarga() {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [isPendingProcesar, startTransitionProcesar] = useTransition();
  const [isPendingGuardar, startTransitionGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ctgBuscado, setCtgBuscado] = useState<string | null>(null);
  const [viajesEncontrados, setViajesEncontrados] = useState<ViajeEncontradoPorCtg[] | null>(null);
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
    setViajeElegido(null);
  }

  function procesar() {
    if (!archivo) return;
    setError(null);
    setViajesEncontrados(null);
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
    form.reset({
      fecha_arribo: (datos.fecha_arribo ?? undefined) as unknown as Date,
      fecha_descarga: (datos.fecha_descarga ?? undefined) as unknown as Date,
      n_turno_descarga: datos.n_turno_descarga ?? "",
      bruto_destino: datos.bruto_destino_kg != null ? String(datos.bruto_destino_kg) : "",
      tara_destino: datos.tara_destino_kg != null ? String(datos.tara_destino_kg) : "",
      neto_destino: datos.neto_destino_kg != null ? String(datos.neto_destino_kg) : "",
      humedad_pct: datos.humedad_pct != null ? String(datos.humedad_pct) : "",
      merma_precio_unitario: "",
    });
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
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <p className="text-sm text-muted-foreground">
            Encontré {viajesEncontrados.length} viajes con el CTG {ctgBuscado}. Elegí cuál es:
          </p>
          <div className="flex flex-col gap-2">
            {viajesEncontrados.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() =>
                  elegirViaje(v, {
                    ctg: ctgBuscado,
                    fecha_arribo: null,
                    fecha_descarga: null,
                    n_turno_descarga: null,
                    bruto_destino_kg: null,
                    tara_destino_kg: null,
                    neto_destino_kg: null,
                    humedad_pct: null,
                  })
                }
                className="flex items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted"
              >
                <span>
                  #{v.numero} — {v.cliente_nombre ?? "—"} — {v.chofer_nombre ?? "—"} —{" "}
                  {v.dominio_tractor ?? "—"}
                </span>
                <span className="text-muted-foreground">{ETIQUETAS_ESTADO[v.estado] ?? v.estado}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {viajeElegido && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <p className="font-semibold">
              Viaje #{viajeElegido.numero} — CTG {viajeElegido.ctg}
            </p>
            <p className="text-muted-foreground">
              {viajeElegido.cliente_nombre ?? "—"} · Chofer: {viajeElegido.chofer_nombre ?? "—"} ·
              Camión: {viajeElegido.dominio_tractor ?? "—"} ·{" "}
              {ETIQUETAS_ESTADO[viajeElegido.estado] ?? viajeElegido.estado}
            </p>
          </div>

          {yaTieneDescarga && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Este viaje ya tiene datos de descarga cargados</AlertTitle>
              <AlertDescription>
                Fecha de descarga actual:{" "}
                {viajeElegido.fecha_descarga ? formatoFecha.format(viajeElegido.fecha_descarga) : "—"}.
                Si continuás, se van a reemplazar por los datos de abajo.
                <label className="mt-2 flex items-center gap-2">
                  <Checkbox
                    checked={confirmaSobrescribir}
                    onCheckedChange={(v) => setConfirmaSobrescribir(!!v)}
                  />
                  Sí, quiero sobrescribir los datos de descarga existentes.
                </label>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampoTexto form={form} name="fecha_arribo" label="Fecha de arribo" tipo="date" />
            <CampoTexto form={form} name="fecha_descarga" label="Fecha de descarga" tipo="date" />
            <CampoTexto form={form} name="n_turno_descarga" label="N° de turno" />
            <CampoPeso form={form} name="bruto_destino" label="Peso bruto (destino)" />
            <CampoPeso form={form} name="tara_destino" label="Tara (destino)" />
            <CampoPeso form={form} name="neto_destino" label="Peso neto (destino)" />
            <CampoTexto form={form} name="humedad_pct" label="Humedad (%)" />
          </div>

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
