"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/data-table/data-table";
import { tableFeaturesBase } from "@/components/data-table/features";

type ResultadoAccion = { error?: string } | void;

type FilaBase = { id: number };

type Props<T extends FilaBase, TInput extends FieldValues> = {
  titulo: string;
  filas: T[];
  columnas: ColumnDef<typeof tableFeaturesBase, T>[];
  etiquetaFila: (fila: T) => string;
  resolver: Resolver<TInput>;
  valoresPorDefecto: TInput;
  aValoresFormulario: (fila: T) => TInput;
  campos: (form: UseFormReturn<TInput>) => React.ReactNode;
  crear: (valores: TInput) => Promise<ResultadoAccion>;
  actualizar: (id: number, valores: TInput) => Promise<ResultadoAccion>;
  eliminar: (id: number) => Promise<ResultadoAccion>;
};

export function AbmCatalogoSimple<T extends FilaBase, TInput extends FieldValues>({
  titulo,
  filas,
  columnas: columnasTabla,
  etiquetaFila,
  resolver,
  valoresPorDefecto,
  aValoresFormulario,
  campos,
  crear,
  actualizar,
  eliminar,
}: Props<T, TInput>) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [filaEditando, setFilaEditando] = useState<T | null>(null);
  const [filaAEliminar, setFilaAEliminar] = useState<T | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<TInput>({
    resolver,
    defaultValues: valoresPorDefecto as DefaultValues<TInput>,
  });

  function abrirNuevo() {
    setFilaEditando(null);
    form.reset(valoresPorDefecto);
    setAbierto(true);
  }

  function abrirEditar(fila: T) {
    setFilaEditando(fila);
    form.reset(aValoresFormulario(fila));
    setAbierto(true);
  }

  function onSubmit(valores: TInput) {
    startTransition(async () => {
      const resultado = filaEditando
        ? await actualizar(filaEditando.id, valores)
        : await crear(valores);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(filaEditando ? "Guardado." : "Creado.");
      setAbierto(false);
      router.refresh();
    });
  }

  function confirmarEliminar() {
    if (!filaAEliminar) return;
    startTransition(async () => {
      const resultado = await eliminar(filaAEliminar.id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Eliminado.");
      setFilaAEliminar(null);
      router.refresh();
    });
  }

  const columnas: ColumnDef<typeof tableFeaturesBase, T>[] = [
    ...columnasTabla,
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => abrirEditar(row.original)}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setFilaAEliminar(row.original)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={abrirNuevo}>
          <Plus className="size-4" />
          Nuevo
        </Button>
      </div>

      <DataTable columnas={columnas} datos={filas} sinFilas="Todavía no hay registros." />

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{filaEditando ? `Editar ${titulo}` : `Nuevo ${titulo}`}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmit as SubmitHandler<TInput>)}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{campos(form)}</div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!filaAEliminar} onOpenChange={(v) => !v && setFilaAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar &quot;{filaAEliminar ? etiquetaFila(filaAEliminar) : ""}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={confirmarEliminar}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
