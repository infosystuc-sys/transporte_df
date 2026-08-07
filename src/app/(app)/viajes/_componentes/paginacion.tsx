"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useQueryString } from "../_lib/usar-query-string";

export function Paginacion({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const queryString = useQueryString();
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {total} viaje{total === 1 ? "" : "s"} — página {page} de {totalPaginas}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
          {page > 1 ? (
            <Link href={queryString({ page: String(page - 1) })}>Anterior</Link>
          ) : (
            <span>Anterior</span>
          )}
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPaginas} asChild={page < totalPaginas}>
          {page < totalPaginas ? (
            <Link href={queryString({ page: String(page + 1) })}>Siguiente</Link>
          ) : (
            <span>Siguiente</span>
          )}
        </Button>
      </div>
    </div>
  );
}
