"use client";

import { useTable, type ColumnDef } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tableFeaturesBase } from "./features";

type Props<TData extends Record<string, unknown>> = {
  columnas: ColumnDef<typeof tableFeaturesBase, TData>[];
  datos: TData[];
  sinFilas?: string;
  onFilaClick?: (fila: TData) => void;
  /**
   * En mobile cada fila se muestra como tarjeta con "etiqueta: valor" por
   * columna (ver TableCell). La etiqueta sale del header de la columna
   * cuando es texto plano; para columnas con header custom (ej. un botón
   * de orden) hay que pasar acá la etiqueta por id de columna.
   */
  etiquetasMobil?: Record<string, string>;
};

/**
 * Tabla genérica sobre TanStack Table v9. No usa las features de
 * sorting/paginación/filtrado de la librería: cuando hacen falta, se
 * resuelven del lado del servidor (query params + Drizzle) y esta tabla
 * solo renderiza la página de datos ya procesada.
 */
export function DataTable<TData extends Record<string, unknown>>({
  columnas,
  datos,
  sinFilas = "Sin resultados.",
  onFilaClick,
  etiquetasMobil,
}: Props<TData>) {
  const table = useTable({ features: tableFeaturesBase, columns: columnas, data: datos });

  return (
    <div className="rounded-md border shadow-(--shadow)">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((grupo) => (
            <TableRow key={grupo.id}>
              {grupo.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnas.length}
                className="h-24 text-center text-muted-foreground"
              >
                {sinFilas}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onFilaClick ? () => onFilaClick(row.original) : undefined}
                className={onFilaClick ? "cursor-pointer" : undefined}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    data-label={
                      etiquetasMobil?.[cell.column.id] ??
                      (typeof cell.column.columnDef.header === "string"
                        ? cell.column.columnDef.header
                        : "")
                    }
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
