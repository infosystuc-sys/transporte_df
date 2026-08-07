"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signoTipoMovimiento } from "@/lib/cuenta-corriente/signo";
import { liquidacionCabeceraSchema, type LiquidacionCabeceraInput } from "@/lib/schemas/liquidaciones";
import { crearLiquidacion } from "../../actions";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

const ETIQUETAS_TIPO: Record<string, string> = {
  adelanto: "Adelanto",
  gasoil: "Gasoil a cuenta",
  gasto_rendido: "Gasto rendido",
  liquidacion: "Liquidación",
  devolucion: "Devolución",
  ajuste: "Ajuste",
};

type Opcion = { id: number; nombre: string };
type ViajePendiente = {
  id: number;
  numero: number;
  fecha_carga: Date | null;
  importe_liquidacion_chofer: string | null;
};
type MovimientoPendiente = {
  id: number;
  fecha: Date;
  tipo: string;
  importe: string;
  descripcion: string | null;
};

const valoresPorDefectoCabecera: LiquidacionCabeceraInput = {
  chofer_id: undefined as unknown as number,
  fecha: new Date().toISOString().slice(0, 10) as unknown as Date,
  periodo_desde: undefined,
  periodo_hasta: undefined,
  medio_pago_id: undefined,
  observaciones: "",
};

export function FormularioLiquidacion({
  choferes,
  medioPagos,
  choferId,
  viajesPendientes,
  movimientosPendientes,
}: {
  choferes: Opcion[];
  medioPagos: Opcion[];
  choferId: number | undefined;
  viajesPendientes: ViajePendiente[];
  movimientosPendientes: MovimientoPendiente[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [viajesSeleccionados, setViajesSeleccionados] = useState<Record<number, boolean>>({});
  const [movimientosSeleccionados, setMovimientosSeleccionados] = useState<Record<number, boolean>>({});

  const form = useForm<LiquidacionCabeceraInput>({
    resolver: zodResolver(liquidacionCabeceraSchema),
    defaultValues: { ...valoresPorDefectoCabecera, chofer_id: choferId as unknown as number },
  });

  const totalViajes = useMemo(
    () =>
      viajesPendientes
        .filter((v) => viajesSeleccionados[v.id])
        .reduce((s, v) => s + Number(v.importe_liquidacion_chofer ?? 0), 0),
    [viajesPendientes, viajesSeleccionados]
  );
  const totalMovimientos = useMemo(
    () =>
      movimientosPendientes
        .filter((m) => movimientosSeleccionados[m.id])
        .reduce((s, m) => s + signoTipoMovimiento(m.tipo) * Number(m.importe), 0),
    [movimientosPendientes, movimientosSeleccionados]
  );
  const totalNeto = totalViajes + totalMovimientos;

  function cambiarChofer(valor: string) {
    router.push(`/liquidaciones/nueva?chofer_id=${valor}`);
  }

  function onSubmit(cabecera: LiquidacionCabeceraInput) {
    const viajes = viajesPendientes
      .filter((v) => viajesSeleccionados[v.id])
      .map((v) => ({ viaje_id: v.id, importe: v.importe_liquidacion_chofer ?? "0" }));
    const movimientos = movimientosPendientes
      .filter((m) => movimientosSeleccionados[m.id])
      .map((m) => ({ movimiento_id: m.id }));

    startTransition(async () => {
      const resultado = await crearLiquidacion({ cabecera, viajes, movimientos });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Liquidación registrada.");
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Chofer</label>
        <Select value={choferId ? String(choferId) : undefined} onValueChange={cambiarChofer}>
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Elegí un chofer" />
          </SelectTrigger>
          <SelectContent>
            {choferes.map((c) => (
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
        <CampoTexto form={form} name="periodo_desde" label="Período desde" tipo="date" />
        <CampoTexto form={form} name="periodo_hasta" label="Período hasta" tipo="date" />
      </div>
      <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />

      {choferId && (
        <>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Viajes pendientes de liquidar</h3>
            {viajesPendientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay viajes con importe de liquidación calculado y pendiente para este chofer.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {viajesPendientes.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <label className="flex items-center gap-3">
                      <Checkbox
                        checked={!!viajesSeleccionados[v.id]}
                        onCheckedChange={(marcado) =>
                          setViajesSeleccionados((prev) => ({ ...prev, [v.id]: !!marcado }))
                        }
                      />
                      <span>
                        #{v.numero}
                        {v.fecha_carga && ` — ${formatoFecha.format(v.fecha_carga)}`}
                      </span>
                    </label>
                    <span className="text-sm">
                      {formatoARS.format(Number(v.importe_liquidacion_chofer ?? 0))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-muted-foreground">
              Total viajes: {formatoARS.format(totalViajes)}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Movimientos pendientes de la cuenta corriente
            </h3>
            {movimientosPendientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin movimientos pendientes.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {movimientosPendientes.map((m) => {
                  const signo = signoTipoMovimiento(m.tipo);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                      <label className="flex items-center gap-3">
                        <Checkbox
                          checked={!!movimientosSeleccionados[m.id]}
                          onCheckedChange={(marcado) =>
                            setMovimientosSeleccionados((prev) => ({ ...prev, [m.id]: !!marcado }))
                          }
                        />
                        <span>
                          {ETIQUETAS_TIPO[m.tipo] ?? m.tipo} — {formatoFecha.format(m.fecha)}
                          {m.descripcion && ` — ${m.descripcion}`}
                        </span>
                      </label>
                      <span className={signo > 0 ? "text-emerald-600" : "text-destructive"}>
                        {signo > 0 ? "+" : "−"}
                        {formatoARS.format(Number(m.importe))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">Total neto a pagar</p>
            <p className="text-lg font-semibold">{formatoARS.format(totalNeto)}</p>
          </div>
        </>
      )}

      <div>
        <Button type="submit" disabled={isPending || !choferId}>
          {isPending ? "Guardando..." : "Registrar liquidación"}
        </Button>
      </div>
    </form>
  );
}
