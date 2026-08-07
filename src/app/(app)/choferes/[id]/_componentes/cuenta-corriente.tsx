"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import {
  movimientoManualSchema,
  type MovimientoManualInput,
} from "@/lib/schemas/choferes-cuenta";
import { formatoFechaInput } from "@/lib/schemas/campos-fecha";
import { crearMovimientoManual } from "../../actions";
import { calcularSaldo, signoTipoMovimiento } from "@/lib/cuenta-corriente/signo";

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

type Movimiento = {
  id: number;
  fecha: Date;
  tipo: string;
  importe: string;
  descripcion: string | null;
  origen_automatico: boolean;
};

const opcionesTipo = [
  { value: "adelanto", label: "Adelanto" },
  { value: "devolucion", label: "Devolución" },
  { value: "ajuste", label: "Ajuste" },
];

const valoresPorDefecto: MovimientoManualInput = {
  fecha: formatoFechaInput(new Date()) as unknown as Date,
  tipo: "adelanto",
  importe: "",
  medio_pago_id: undefined,
  descripcion: "",
};

export function CuentaCorriente({
  choferId,
  movimientos,
  medioPagos,
}: {
  choferId: number;
  movimientos: Movimiento[];
  medioPagos: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<MovimientoManualInput>({
    resolver: zodResolver(movimientoManualSchema),
    defaultValues: valoresPorDefecto,
  });

  const saldo = calcularSaldo(movimientos);

  function onSubmit(valores: MovimientoManualInput) {
    startTransition(async () => {
      const resultado = await crearMovimientoManual(choferId, valores);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Registrado.");
      form.reset(valoresPorDefecto);
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-md border p-4">
        <div>
          <p className="text-sm text-muted-foreground">Saldo</p>
          <p className="text-lg font-semibold">
            {saldo >= 0
              ? `La empresa le debe ${formatoARS.format(saldo)}`
              : `El chofer debe ${formatoARS.format(-saldo)}`}
          </p>
        </div>
        <Button onClick={() => setAbierto(true)}>Registrar adelanto</Button>
      </div>

      {movimientos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin movimientos.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {movimientos.map((m) => {
            const signo = signoTipoMovimiento(m.tipo);
            return (
              <li key={m.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ETIQUETAS_TIPO[m.tipo] ?? m.tipo}</span>
                    {m.origen_automatico && <Badge variant="outline">Automático</Badge>}
                  </div>
                  {m.descripcion && <p className="text-sm text-muted-foreground">{m.descripcion}</p>}
                  <p className="text-xs text-muted-foreground">{formatoFecha.format(m.fecha)}</p>
                </div>
                <span className={signo > 0 ? "text-emerald-600" : "text-destructive"}>
                  {signo > 0 ? "+" : "−"}
                  {formatoARS.format(Number(m.importe))}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo movimiento</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <CampoSelect form={form} name="tipo" label="Tipo" opciones={opcionesTipo} />
            <CampoTexto form={form} name="fecha" label="Fecha" tipo="date" />
            <CampoTexto form={form} name="importe" label="Importe ($)" />
            <CampoSelect
              form={form}
              name="medio_pago_id"
              label="Medio de pago"
              opciones={medioPagos.map((m) => ({ value: String(m.id), label: m.nombre }))}
            />
            <CampoTexto form={form} name="descripcion" label="Descripción" textarea />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
