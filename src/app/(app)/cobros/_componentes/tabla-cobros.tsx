"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { tableFeaturesBase } from "@/components/data-table/features";
import { Button } from "@/components/ui/button";
import { eliminarCobro } from "../actions";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

export type FilaCobro = {
  id: number;
  fecha: Date;
  cliente_nombre: string | null;
  medio_pago_nombre: string | null;
  importe: string;
  referencia: string | null;
};

export function TablaCobros({ filas }: { filas: FilaCobro[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function eliminar(id: number) {
    startTransition(async () => {
      const resultado = await eliminarCobro(id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Eliminado.");
      router.refresh();
    });
  }

  const columnas: ColumnDef<typeof tableFeaturesBase, FilaCobro>[] = [
    { accessorKey: "fecha", header: "Fecha", cell: ({ getValue }) => formatoFecha.format(getValue() as Date) },
    { accessorKey: "cliente_nombre", header: "Cliente", cell: ({ getValue }) => getValue() ?? "—" },
    { accessorKey: "medio_pago_nombre", header: "Medio de pago", cell: ({ getValue }) => getValue() ?? "—" },
    {
      accessorKey: "importe",
      header: "Importe",
      cell: ({ getValue }) => formatoARS.format(Number(getValue())),
    },
    { accessorKey: "referencia", header: "Referencia", cell: ({ getValue }) => getValue() ?? "—" },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={() => eliminar(row.original.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return <DataTable columnas={columnas} datos={filas} sinFilas="Todavía no hay cobros registrados." />;
}
