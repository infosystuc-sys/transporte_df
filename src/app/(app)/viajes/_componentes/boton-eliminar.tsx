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
import { eliminarViaje } from "../actions";

export function BotonEliminar({ viajeId, numero }: { viajeId: number; numero: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const resultado = await eliminarViaje(viajeId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Viaje eliminado.");
      router.push("/viajes");
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Trash2 className="size-4" />
          Eliminar viaje
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar el viaje #{numero}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borran también sus gastos, adicionales, contingencias y adjuntos cargados (CPE,
            fotos, comprobantes). Esta acción no se puede deshacer.
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
