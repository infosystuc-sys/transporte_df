"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { tableFeaturesBase } from "@/components/data-table/features";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnaOrdenable } from "../_lib/orden";
import { useQueryString } from "../_lib/usar-query-string";
import type { EstadoViaje } from "../_lib/estados";

export type FilaViaje = {
  id: number;
  numero: number;
  estado: EstadoViaje;
  ctg: string | null;
  cpe_nro: string | null;
  fecha_carga: Date | null;
  dominio_tractor: string | null;
  cliente_nombre: string | null;
  chofer_nombre: string | null;
  origen_nombre: string | null;
  destino_nombre: string | null;
  neto_destino: string | null;
  merma_excede_tolerancia: boolean;
};

const ETIQUETAS_ESTADO: Record<EstadoViaje, string> = {
  planificado: "Planificado",
  cargado: "Cargado",
  en_transito: "En tránsito",
  descargado: "Descargado",
  facturado: "Facturado",
  cobrado: "Cobrado",
  liquidado: "Liquidado",
  rechazado: "Rechazado",
};

function formatoFechaCorta(f: Date | null) {
  if (!f) return "—";
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" }).format(f);
}

function formatoTn(kg: string | null) {
  if (!kg) return "—";
  return `${(Number(kg) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} tn`;
}

function EncabezadoOrdenable({
  columna,
  etiqueta,
  sortActual,
  dirActual,
  queryString,
}: {
  columna: ColumnaOrdenable;
  etiqueta: string;
  sortActual?: string;
  dirActual?: string;
  queryString: (patch: Record<string, string | undefined>) => string;
}) {
  const activa = sortActual === columna;
  const proximaDir = activa && dirActual === "asc" ? "desc" : "asc";
  const Icono = !activa ? ArrowUpDown : dirActual === "asc" ? ArrowUp : ArrowDown;

  return (
    <Button variant="ghost" size="sm" className="-ml-3" asChild>
      <Link href={queryString({ sort: columna, dir: proximaDir, page: undefined })}>
        {etiqueta}
        <Icono className="size-3.5" />
      </Link>
    </Button>
  );
}

export function TablaViajes({
  filas,
  sort,
  dir,
}: {
  filas: FilaViaje[];
  sort?: string;
  dir?: string;
}) {
  const queryString = useQueryString();
  const columnas: ColumnDef<typeof tableFeaturesBase, FilaViaje>[] = [
    {
      accessorKey: "numero",
      header: () => (
        <EncabezadoOrdenable
          columna="numero"
          etiqueta="N°"
          sortActual={sort}
          dirActual={dir}
          queryString={queryString}
        />
      ),
    },
    {
      accessorKey: "fecha_carga",
      header: () => (
        <EncabezadoOrdenable
          columna="fecha_carga"
          etiqueta="Fecha de carga"
          sortActual={sort}
          dirActual={dir}
          queryString={queryString}
        />
      ),
      cell: ({ getValue }) => formatoFechaCorta(getValue() as Date | null),
    },
    {
      accessorKey: "ctg",
      header: () => (
        <EncabezadoOrdenable
          columna="ctg"
          etiqueta="CTG / CPE"
          sortActual={sort}
          dirActual={dir}
          queryString={queryString}
        />
      ),
      cell: ({ row }) => row.original.ctg ?? row.original.cpe_nro ?? "—",
    },
    { accessorKey: "cliente_nombre", header: "Cliente", cell: ({ getValue }) => getValue() ?? "—" },
    {
      id: "ruta",
      header: "Origen → Destino",
      cell: ({ row }) => `${row.original.origen_nombre ?? "—"} → ${row.original.destino_nombre ?? "—"}`,
    },
    { accessorKey: "dominio_tractor", header: "Dominio", cell: ({ getValue }) => getValue() ?? "—" },
    { accessorKey: "chofer_nombre", header: "Chofer", cell: ({ getValue }) => getValue() ?? "—" },
    {
      accessorKey: "neto_destino",
      header: "TN destino",
      cell: ({ getValue }) => formatoTn(getValue() as string | null),
    },
    {
      accessorKey: "estado",
      header: () => (
        <EncabezadoOrdenable
          columna="estado"
          etiqueta="Estado"
          sortActual={sort}
          dirActual={dir}
          queryString={queryString}
        />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={row.original.estado === "rechazado" ? "destructive" : "outline"}>
            {ETIQUETAS_ESTADO[row.original.estado]}
          </Badge>
          {row.original.merma_excede_tolerancia && <Badge variant="destructive">Merma</Badge>}
        </div>
      ),
    },
  ];

  const router = useRouter();

  return (
    <DataTable
      columnas={columnas}
      datos={filas}
      sinFilas="No hay viajes para estos filtros."
      onFilaClick={(fila) => router.push(`/viajes/${fila.id}`)}
      etiquetasMobil={{
        numero: "N°",
        fecha_carga: "Fecha de carga",
        ctg: "CTG / CPE",
        estado: "Estado",
      }}
    />
  );
}
