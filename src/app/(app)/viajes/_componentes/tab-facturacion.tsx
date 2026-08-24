"use client";

import { useEffect, useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { viajeFacturacionSchema, type ViajeFacturacionInput } from "@/lib/schemas/viajes";
import { actualizarFacturacion } from "../actions";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

type Imputacion = {
  id: number;
  importe_imputado: string;
  cobro_fecha: Date;
  medio_pago_nombre: string | null;
};

export function TabFacturacion({
  viajeId,
  valoresIniciales,
  condicionesPago,
  fechaVtoCobro,
  importeCobrado,
  saldoPendiente,
  imputaciones,
}: {
  viajeId: number;
  valoresIniciales: ViajeFacturacionInput;
  condicionesPago: { id: number; nombre: string }[];
  fechaVtoCobro: Date | null;
  importeCobrado: string | null;
  saldoPendiente: string | null;
  imputaciones: Imputacion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ViajeFacturacionInput>({
    resolver: zodResolver(viajeFacturacionSchema),
    defaultValues: valoresIniciales,
  });

  const neto = form.watch("factura_importe_neto");
  const ivaTocado = useRef(!!valoresIniciales.factura_iva);

  useEffect(() => {
    if (ivaTocado.current) return;
    const netoNum = neto ? Number(neto) : undefined;
    if (netoNum !== undefined && !Number.isNaN(netoNum)) {
      const iva = netoNum * 0.21;
      form.setValue("factura_iva", iva.toFixed(2));
      form.setValue("factura_importe_total", (netoNum + iva).toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neto]);

  function onSubmit(valores: ViajeFacturacionInput) {
    startTransition(async () => {
      const resultado = await actualizarFacturacion(viajeId, valores);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Guardado.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoTexto form={form} name="factura_nro" label="N° de factura" />
          <CampoTexto form={form} name="factura_fecha" label="Fecha de factura" tipo="date" />
          <CampoSelect
            form={form}
            name="condicion_pago_id"
            label="Condición de pago"
            opciones={condicionesPago.map((c) => ({ value: String(c.id), label: c.nombre }))}
          />
          <CampoTexto form={form} name="factura_importe_neto" label="Importe neto ($)" />
          <CampoTexto
            form={form}
            name="factura_iva"
            label="IVA ($, se precarga al 21% del neto)"
          />
          <CampoTexto form={form} name="factura_importe_total" label="Importe total ($)" />
        </div>
        <p className="text-xs text-muted-foreground">
          La factura se emite en Sinagro; acá solo se registra. El sistema no calcula alícuotas
          por sí solo, el 21% es apenas un valor inicial editable.
        </p>
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm sm:grid-cols-3 [&>div]:min-w-0 [&_p]:break-words">
        <div>
          <p className="text-muted-foreground">Vencimiento de cobro</p>
          <p>{fechaVtoCobro ? formatoFecha.format(fechaVtoCobro) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Cobrado</p>
          <p>{importeCobrado ? formatoARS.format(Number(importeCobrado)) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Saldo pendiente</p>
          <p>{saldoPendiente ? formatoARS.format(Number(saldoPendiente)) : "—"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Cobros imputados</h3>
        {imputaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin cobros imputados todavía. Se registran desde la pantalla de Cobros.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {imputaciones.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-md border p-3">
                <span>
                  {formatoFecha.format(i.cobro_fecha)} — {i.medio_pago_nombre ?? "—"}
                </span>
                <span>{formatoARS.format(Number(i.importe_imputado))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
