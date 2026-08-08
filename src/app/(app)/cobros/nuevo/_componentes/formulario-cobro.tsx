"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cobroCabeceraSchema, type CobroCabeceraInput } from "@/lib/schemas/cobros";
import { crearCobro } from "../../actions";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

type Opcion = { id: number; nombre: string };
type ViajePendiente = {
  id: number;
  numero: number;
  factura_nro: string | null;
  fecha_vto_cobro: Date | null;
  saldo_pendiente: string | null;
};
type TipoRetencion = "ganancias" | "iibb" | "iva" | "sicore" | "otro";
type Retencion = { tipo: TipoRetencion; importe: string; certificado_nro: string };

const opcionesTipoRetencion = [
  { value: "ganancias", label: "Ganancias" },
  { value: "iibb", label: "IIBB" },
  { value: "iva", label: "IVA" },
  { value: "sicore", label: "SICORE" },
  { value: "otro", label: "Otro" },
];

const valoresPorDefectoCabecera: CobroCabeceraInput = {
  fecha: new Date().toISOString().slice(0, 10) as unknown as Date,
  cliente_id: undefined as unknown as number,
  medio_pago_id: undefined as unknown as number,
  importe: "",
  referencia: "",
  banco: "",
  cheque_nro: "",
  cheque_vto: undefined,
  observaciones: "",
};

export function FormularioCobro({
  clientes,
  medioPagos,
  clienteId,
  viajesPendientes,
}: {
  clientes: Opcion[];
  medioPagos: Opcion[];
  clienteId: number | undefined;
  viajesPendientes: ViajePendiente[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [seleccionados, setSeleccionados] = useState<Record<number, string>>({});
  const [retenciones, setRetenciones] = useState<Retencion[]>([]);

  const form = useForm<CobroCabeceraInput>({
    resolver: zodResolver(cobroCabeceraSchema),
    defaultValues: { ...valoresPorDefectoCabecera, cliente_id: clienteId as unknown as number },
  });

  const totalImputado = useMemo(
    () => Object.values(seleccionados).reduce((s, v) => s + (Number(v) || 0), 0),
    [seleccionados]
  );
  const totalRetenciones = useMemo(
    () => retenciones.reduce((s, r) => s + (Number(r.importe) || 0), 0),
    [retenciones]
  );

  function cambiarCliente(valor: string) {
    router.push(`/cobros/nuevo?cliente_id=${valor}`);
  }

  function alternarViaje(viaje: ViajePendiente, marcado: boolean) {
    setSeleccionados((prev) => {
      const copia = { ...prev };
      if (marcado) {
        copia[viaje.id] = viaje.saldo_pendiente ?? "0";
      } else {
        delete copia[viaje.id];
      }
      return copia;
    });
  }

  function agregarRetencion() {
    setRetenciones((prev) => [...prev, { tipo: "otro", importe: "", certificado_nro: "" }]);
  }
  function quitarRetencion(i: number) {
    setRetenciones((prev) => prev.filter((_, idx) => idx !== i));
  }
  function actualizarRetencion(i: number, campo: keyof Retencion, valor: string) {
    setRetenciones((prev) =>
      prev.map((r, idx) => (idx === i ? ({ ...r, [campo]: valor } as Retencion) : r))
    );
  }

  function onSubmit(cabecera: CobroCabeceraInput) {
    const imputaciones = Object.entries(seleccionados)
      .filter(([, importe]) => Number(importe) > 0)
      .map(([viajeId, importe]) => ({ viaje_id: Number(viajeId), importe_imputado: importe }));

    startTransition(async () => {
      const resultado = await crearCobro({
        cabecera,
        imputaciones,
        retenciones: retenciones.filter((r) => Number(r.importe) > 0),
      });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Cobro registrado.");
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-[11.5px] font-bold uppercase tracking-[0.03em] text-muted-foreground">Cliente (pagador)</label>
        <Select value={clienteId ? String(clienteId) : undefined} onValueChange={cambiarCliente}>
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Elegí un cliente" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoTexto form={form} name="fecha" label="Fecha" tipo="date" />
        <CampoSelect
          form={form}
          name="medio_pago_id"
          label="Medio de pago"
          opciones={medioPagos.map((m) => ({ value: String(m.id), label: m.nombre }))}
        />
        <CampoTexto form={form} name="importe" label="Importe del cobro ($)" />
        <CampoTexto form={form} name="referencia" label="Referencia" />
        <CampoTexto form={form} name="banco" label="Banco" />
        <CampoTexto form={form} name="cheque_nro" label="N° de cheque" />
        <CampoTexto form={form} name="cheque_vto" label="Vencimiento del cheque" tipo="date" />
      </div>
      <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />

      {clienteId && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Viajes pendientes de este cliente
          </h3>
          {viajesPendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay viajes facturados pendientes de cobro para este cliente.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {viajesPendientes.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={v.id in seleccionados}
                      onCheckedChange={(marcado) => alternarViaje(v, !!marcado)}
                    />
                    <span>
                      #{v.numero} — Factura {v.factura_nro ?? "—"}
                      {v.fecha_vto_cobro && ` — vence ${formatoFecha.format(v.fecha_vto_cobro)}`}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Saldo {v.saldo_pendiente ? formatoARS.format(Number(v.saldo_pendiente)) : "—"}
                    </span>
                    {v.id in seleccionados && (
                      <Input
                        className="w-32"
                        value={seleccionados[v.id]}
                        onChange={(e) =>
                          setSeleccionados((prev) => ({ ...prev, [v.id]: e.target.value }))
                        }
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">Total imputado: {formatoARS.format(totalImputado)}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Retenciones {retenciones.length > 0 && `— ${formatoARS.format(totalRetenciones)}`}
          </h3>
          <Button type="button" size="sm" variant="outline" onClick={agregarRetencion}>
            <Plus className="size-4" />
            Agregar retención
          </Button>
        </div>
        {retenciones.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Select value={r.tipo} onValueChange={(v) => actualizarRetencion(i, "tipo", v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opcionesTipoRetencion.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Importe"
              value={r.importe}
              onChange={(e) => actualizarRetencion(i, "importe", e.target.value)}
            />
            <Input
              placeholder="N° de certificado"
              value={r.certificado_nro}
              onChange={(e) => actualizarRetencion(i, "certificado_nro", e.target.value)}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => quitarRetencion(i)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div>
        <Button type="submit" disabled={isPending || !clienteId}>
          {isPending ? "Guardando..." : "Registrar cobro"}
        </Button>
      </div>
    </form>
  );
}
