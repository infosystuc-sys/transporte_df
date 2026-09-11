"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatoFechaInput } from "@/lib/schemas/campos-fecha";
import { facturarViajesEnLote } from "../../../viajes/actions";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
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

type FilaViaje = {
  id: number;
  numero: number;
  fecha_carga: Date | null;
  estado: string;
  dominio_tractor: string | null;
  chofer_nombre: string | null;
  total_a_cobrar: string | null;
  saldo_pendiente: string | null;
  facturado: boolean;
};

export function ViajesCliente({ viajes }: { viajes: FilaViaje[] }) {
  const router = useRouter();
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [abierto, setAbierto] = useState(false);
  const [facturaNro, setFacturaNro] = useState("");
  const [facturaFecha, setFacturaFecha] = useState(formatoFechaInput(new Date()));
  const [isPending, startTransition] = useTransition();

  if (viajes.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin viajes registrados.</p>;
  }

  function alternar(id: number, marcado: boolean) {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (marcado) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  function confirmarFactura() {
    startTransition(async () => {
      const resultado = await facturarViajesEnLote([...seleccionados], {
        factura_nro: facturaNro,
        factura_fecha: new Date(facturaFecha),
      });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Viajes facturados.");
      setAbierto(false);
      setSeleccionados(new Set());
      setFacturaNro("");
      router.refresh();
    });
  }

  const hayFacturables = viajes.some((v) => !v.facturado);

  return (
    <div className="flex flex-col gap-3">
      {hayFacturables && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={seleccionados.size === 0}
            onClick={() => setAbierto(true)}
          >
            Facturar seleccionados ({seleccionados.size})
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {viajes.map((v) => (
          <li
            key={v.id}
            className="flex items-center gap-3 rounded-md border p-3 hover:bg-accent"
          >
            {!v.facturado && (
              <Checkbox
                checked={seleccionados.has(v.id)}
                onCheckedChange={(marcado) => alternar(v.id, !!marcado)}
              />
            )}
            <Link href={`/viajes/${v.id}`} className="flex flex-1 items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-medium">
                  #{v.numero} — {v.dominio_tractor ?? "—"} · {v.chofer_nombre ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {v.fecha_carga ? formatoFecha.format(v.fecha_carga) : "Sin fecha de carga"}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-medium">{formatoARS.format(Number(v.total_a_cobrar ?? 0))}</span>
                <div className="flex items-center gap-2">
                  {Number(v.saldo_pendiente ?? 0) > 0 && (
                    <span className="text-xs text-destructive">
                      Pendiente {formatoARS.format(Number(v.saldo_pendiente))}
                    </span>
                  )}
                  <Badge variant="outline">{ETIQUETAS_ESTADO[v.estado] ?? v.estado}</Badge>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Facturar {seleccionados.size} viaje(s)</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Se aplica el mismo N° y fecha de factura a todos los viajes elegidos. El importe de
              cada uno se toma de su propio total a cobrar.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura_nro">N° de factura</Label>
              <Input
                id="factura_nro"
                value={facturaNro}
                onChange={(e) => setFacturaNro(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura_fecha">Fecha de factura</Label>
              <Input
                id="factura_fecha"
                type="date"
                value={facturaFecha}
                onChange={(e) => setFacturaFecha(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!facturaNro.trim() || isPending} onClick={confirmarFactura}>
              {isPending ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
