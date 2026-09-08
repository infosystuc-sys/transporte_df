"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { eliminarLiquidacion } from "../../actions";

export function BotonEliminarLiquidacion({ liquidacionId }: { liquidacionId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const resultado = await eliminarLiquidacion(liquidacionId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Liquidación eliminada.");
      router.push("/liquidaciones");
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Trash2 className="size-4" />
          Eliminar liquidación
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar la liquidación #{liquidacionId}?</AlertDialogTitle>
          <AlertDialogDescription>
            Los viajes incluidos vuelven a quedar pendientes de liquidar, y los adelantos u otros
            movimientos que se saldaron con esta liquidación vuelven a aparecer como pendientes en
            la cuenta corriente del chofer. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={confirmar}>
            {isPending ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
