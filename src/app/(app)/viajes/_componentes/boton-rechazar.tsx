"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rechazarViaje } from "../actions";

const ESTADOS_CON_RECHAZO_HABILITADO = ["en_transito", "descargado"];

export function BotonRechazar({
  viajeId,
  estadoActual,
}: {
  viajeId: number;
  estadoActual: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [rechazado, setRechazado] = useState(false);

  if (!ESTADOS_CON_RECHAZO_HABILITADO.includes(estadoActual)) return null;

  function confirmar() {
    startTransition(async () => {
      const resultado = await rechazarViaje(viajeId, motivo);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Viaje marcado como rechazado.");
      setRechazado(true);
      router.refresh();
    });
  }

  function cerrar(v: boolean) {
    setAbierto(v);
    if (!v) {
      // Se resetea al cerrar para que la próxima apertura arranque de cero.
      setMotivo("");
      setRechazado(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={cerrar}>
      <Button type="button" variant="destructive" size="sm" onClick={() => setAbierto(true)}>
        Marcar como rechazado
      </Button>
      <DialogContent>
        {!rechazado ? (
          <>
            <DialogHeader>
              <DialogTitle>Marcar viaje como rechazado</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                El viaje queda cerrado con este estado — no se reabre. Si la operación sigue, se
                crea un viaje nuevo por separado.
              </p>
              <Label htmlFor="motivo_rechazo">Motivo</Label>
              <Textarea
                id="motivo_rechazo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: destino rechazó la carga por humedad fuera de rango."
              />
            </div>
            <DialogFooter>
              <Button disabled={!motivo.trim() || isPending} onClick={confirmar}>
                {isPending ? "Guardando..." : "Confirmar rechazo"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Viaje rechazado</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Si la carga sigue (por ejemplo, va a reacondicionar), creá el viaje nuevo que
              continúa la operación.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => cerrar(false)}>
                Cerrar
              </Button>
              <Button asChild>
                <Link href={`/viajes/nuevo?reemplaza=${viajeId}`}>Crear viaje de reemplazo</Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
