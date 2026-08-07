"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { marcarLiquidacionPagada } from "../../actions";

export function BotonMarcarPagada({
  liquidacionId,
  pagado,
  medioPagoActual,
  medioPagos,
}: {
  liquidacionId: number;
  pagado: boolean;
  medioPagoActual: string | null;
  medioPagos: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const [medioPagoId, setMedioPagoId] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  if (pagado) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Pagada</Badge>
        {medioPagoActual && <span className="text-sm text-muted-foreground">vía {medioPagoActual}</span>}
      </div>
    );
  }

  function confirmar() {
    startTransition(async () => {
      await marcarLiquidacionPagada(liquidacionId, medioPagoId ? Number(medioPagoId) : undefined);
      toast.success("Marcada como pagada.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-md border p-3">
      <Select value={medioPagoId} onValueChange={setMedioPagoId}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Medio de pago (opcional)" />
        </SelectTrigger>
        <SelectContent>
          {medioPagos.map((m) => (
            <SelectItem key={m.id} value={String(m.id)}>
              {m.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={confirmar} disabled={isPending}>
        {isPending ? "Guardando..." : "Marcar como pagada"}
      </Button>
    </div>
  );
}
