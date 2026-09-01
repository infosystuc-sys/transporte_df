"use client";

import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CampoPeso, CampoTexto } from "@/components/catalogos/campos-formulario";
import type { UseFormReturn } from "react-hook-form";
import type { ViajeDescargaInput } from "@/lib/schemas/viajes";
import type { ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import type { ViajeEncontradoPorCtg } from "../../_lib/buscar-ctg";

export const ETIQUETAS_CAMPOS_DESCARGA: Record<string, string> = {
  ctg: "CTG",
  n_turno_descarga: "N° de turno",
  bruto_destino_kg: "Peso bruto (destino)",
  tara_destino_kg: "Tara (destino)",
  neto_destino_kg: "Peso neto (destino)",
  humedad_pct: "Humedad (%)",
};

export const ETIQUETAS_ESTADO: Record<string, string> = {
  planificado: "Planificado",
  cargado: "Cargado",
  en_transito: "En tránsito",
  descargado: "Descargado",
  facturado: "Facturado",
  cobrado: "Cobrado",
  liquidado: "Liquidado",
  rechazado: "Rechazado",
};

const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

export function construirValoresDescarga(datos: ComprobanteDescargaExtraido): ViajeDescargaInput {
  return {
    fecha_arribo: (datos.fecha_arribo ?? undefined) as unknown as Date,
    fecha_descarga: (datos.fecha_descarga ?? undefined) as unknown as Date,
    n_turno_descarga: datos.n_turno_descarga ?? "",
    bruto_destino: datos.bruto_destino_kg != null ? String(datos.bruto_destino_kg) : "",
    tara_destino: datos.tara_destino_kg != null ? String(datos.tara_destino_kg) : "",
    neto_destino: datos.neto_destino_kg != null ? String(datos.neto_destino_kg) : "",
    humedad_pct: datos.humedad_pct != null ? String(datos.humedad_pct) : "",
    merma_precio_unitario: "",
  };
}

/** Lista para elegir a mano cuando el CTG matchea a más de un viaje cargado. */
export function PickerViajesEncontrados({
  viajes,
  ctgBuscado,
  onElegir,
}: {
  viajes: ViajeEncontradoPorCtg[];
  ctgBuscado: string | null;
  onElegir: (viaje: ViajeEncontradoPorCtg) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <p className="text-sm text-muted-foreground">
        Encontré {viajes.length} viajes con el CTG {ctgBuscado}. Elegí cuál es:
      </p>
      <div className="flex flex-col gap-2">
        {viajes.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onElegir(v)}
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
  );
}

/**
 * El viaje encontrado, el aviso de campos dudosos, el aviso de
 * sobrescritura (si ya tenía descarga cargada) y la grilla de campos
 * editables. No incluye el <form> que lo envuelve ni el botón de
 * confirmar -- eso lo maneja cada pantalla que lo usa (la de un solo
 * archivo y, más adelante, el detalle de cada fila de la tanda).
 */
export function CamposRevisionDescarga({
  form,
  viaje,
  datosExtraidos,
  confirmaSobrescribir,
  onConfirmaSobrescribirChange,
}: {
  form: UseFormReturn<ViajeDescargaInput>;
  viaje: ViajeEncontradoPorCtg;
  datosExtraidos: ComprobanteDescargaExtraido;
  confirmaSobrescribir: boolean;
  onConfirmaSobrescribirChange: (v: boolean) => void;
}) {
  const yaTieneDescarga = !!viaje.fecha_descarga;

  return (
    <>
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        <p className="font-semibold">
          Viaje #{viaje.numero} — CTG {viaje.ctg}
        </p>
        <p className="text-muted-foreground">
          {viaje.cliente_nombre ?? "—"} · Chofer: {viaje.chofer_nombre ?? "—"} · Camión:{" "}
          {viaje.dominio_tractor ?? "—"} · {ETIQUETAS_ESTADO[viaje.estado] ?? viaje.estado}
        </p>
      </div>

      {datosExtraidos.campos_dudosos.length > 0 && (
        <p className="rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
          La IA no está segura de estos campos (foto poco clara en esa zona) — revisalos con más
          atención: {datosExtraidos.campos_dudosos.map((c) => ETIQUETAS_CAMPOS_DESCARGA[c] ?? c).join(", ")}.
        </p>
      )}

      {yaTieneDescarga && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Este viaje ya tiene datos de descarga cargados</AlertTitle>
          <AlertDescription>
            Fecha de descarga actual:{" "}
            {viaje.fecha_descarga ? formatoFecha.format(viaje.fecha_descarga) : "—"}. Si continuás,
            se van a reemplazar por los datos de abajo.
            <label className="mt-2 flex items-center gap-2">
              <Checkbox
                checked={confirmaSobrescribir}
                onCheckedChange={(v) => onConfirmaSobrescribirChange(!!v)}
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
    </>
  );
}
