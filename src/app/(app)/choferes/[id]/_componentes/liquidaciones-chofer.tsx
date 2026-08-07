import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

type Liquidacion = {
  id: number;
  fecha: Date;
  total_viajes: number | null;
  total_neto: string | null;
  pagado: boolean;
};

export function LiquidacionesChofer({
  choferId,
  liquidaciones,
}: {
  choferId: number;
  liquidaciones: Liquidacion[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href={`/liquidaciones/nueva?chofer_id=${choferId}`}>Nueva liquidación</Link>
        </Button>
      </div>

      {liquidaciones.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin liquidaciones registradas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {liquidaciones.map((l) => (
            <li key={l.id}>
              <Link
                href={`/liquidaciones/${l.id}`}
                className="flex items-center justify-between gap-4 rounded-md border p-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatoFecha.format(l.fecha)}</span>
                  <span className="text-sm text-muted-foreground">{l.total_viajes ?? 0} viaje(s)</span>
                  <Badge variant={l.pagado ? "secondary" : "outline"}>
                    {l.pagado ? "Pagada" : "Pendiente de pago"}
                  </Badge>
                </div>
                <span className="font-medium">
                  {l.total_neto ? formatoARS.format(Number(l.total_neto)) : "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
