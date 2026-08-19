"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { cambiarEstadoViaje } from "../actions";
import { ESTADOS_ORDEN, type EstadoViaje } from "../_lib/estados";

const ESTADOS = ESTADOS_ORDEN;

const ETIQUETAS: Record<EstadoViaje, string> = {
  planificado: "Planificado",
  cargado: "Cargado",
  en_transito: "En tránsito",
  descargado: "Descargado",
  facturado: "Facturado",
  cobrado: "Cobrado",
  liquidado: "Liquidado",
  rechazado: "Rechazado",
};

export function StepperEstado({
  viajeId,
  estadoActual,
  facturaNroActual,
}: {
  viajeId: number;
  estadoActual: EstadoViaje;
  facturaNroActual: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pidiendoFactura, setPidiendoFactura] = useState(false);
  const [facturaNro, setFacturaNro] = useState(facturaNroActual ?? "");

  // Estado terminal alternativo: no es un paso de ESTADOS_ORDEN, así que no
  // tiene sentido ofrecer Retroceder/Avanzar ni resaltar ningún paso de la
  // secuencia lineal como "actual". Sale antes de indexOf: "rechazado"
  // nunca está en ESTADOS_ORDEN, así que ni vale la pena buscarlo ahí.
  if (estadoActual === "rechazado") {
    return <Badge variant="destructive">{ETIQUETAS.rechazado}</Badge>;
  }

  const indiceActual = ESTADOS.indexOf(estadoActual);

  function ejecutar(estado: EstadoViaje, nro?: string) {
    startTransition(async () => {
      const resultado = await cambiarEstadoViaje(viajeId, estado, nro);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Estado actualizado.");
      setPidiendoFactura(false);
      router.refresh();
    });
  }

  function irA(estado: EstadoViaje) {
    if (estado === estadoActual) return;
    if (estado === "facturado" && !facturaNroActual) {
      setPidiendoFactura(true);
      return;
    }
    ejecutar(estado);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 overflow-x-auto">
        {ESTADOS.map((estado, i) => (
          <button
            key={estado}
            type="button"
            disabled={isPending}
            onClick={() => irA(estado)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              i === indiceActual
                ? "border-primary bg-primary text-primary-foreground"
                : i < indiceActual
                  ? "border-border bg-muted text-muted-foreground hover:bg-accent"
                  : "border-dashed text-muted-foreground hover:bg-accent"
            )}
          >
            {ETIQUETAS[estado]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={indiceActual <= 0 || isPending}
          onClick={() => irA(ESTADOS[indiceActual - 1])}
        >
          Retroceder
        </Button>
        <Button
          size="sm"
          disabled={indiceActual >= ESTADOS.length - 1 || isPending}
          onClick={() => irA(ESTADOS[indiceActual + 1])}
        >
          Avanzar
        </Button>
      </div>

      <Dialog open={pidiendoFactura} onOpenChange={setPidiendoFactura}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>N° de factura</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Para pasar a Facturado hace falta un N° de factura.
            </p>
            <Label htmlFor="factura_nro">N° de factura</Label>
            <Input
              id="factura_nro"
              value={facturaNro}
              onChange={(e) => setFacturaNro(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!facturaNro.trim() || isPending}
              onClick={() => ejecutar("facturado", facturaNro)}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
