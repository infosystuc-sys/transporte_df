import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { choferes, liquidacionesChofer } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Liquidaciones — Gestión de Fletes",
};

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

export default async function LiquidacionesPage() {
  const filas = await db
    .select({
      id: liquidacionesChofer.id,
      fecha: liquidacionesChofer.fecha,
      chofer_nombre: choferes.nombre_completo,
      total_viajes: liquidacionesChofer.total_viajes,
      total_neto: liquidacionesChofer.total_neto,
      pagado: liquidacionesChofer.pagado,
    })
    .from(liquidacionesChofer)
    .leftJoin(choferes, eq(liquidacionesChofer.chofer_id, choferes.id))
    .orderBy(desc(liquidacionesChofer.fecha));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Liquidaciones</h1>
        <Button asChild>
          <Link href="/liquidaciones/nueva">Nueva liquidación</Link>
        </Button>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay liquidaciones registradas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((f) => (
            <li key={f.id}>
              <Link
                href={`/liquidaciones/${f.id}`}
                className="flex items-center justify-between gap-4 rounded-md border p-3 hover:bg-muted/50"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{f.chofer_nombre ?? "—"}</span>
                    <Badge variant={f.pagado ? "secondary" : "outline"}>
                      {f.pagado ? "Pagada" : "Pendiente de pago"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatoFecha.format(f.fecha)} — {f.total_viajes ?? 0} viaje(s)
                  </p>
                </div>
                <span className="font-medium">
                  {f.total_neto ? formatoARS.format(Number(f.total_neto)) : "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
