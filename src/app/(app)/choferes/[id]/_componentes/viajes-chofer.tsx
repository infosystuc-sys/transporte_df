import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

const ETIQUETAS_ESTADO: Record<string, string> = {
  planificado: "Planificado",
  cargado: "Cargado",
  en_transito: "En tránsito",
  descargado: "Descargado",
  facturado: "Facturado",
  cobrado: "Cobrado",
  liquidado: "Liquidado",
};

type FilaViaje = {
  id: number;
  numero: number;
  fecha_carga: Date | null;
  estado: string;
  cliente_nombre: string | null;
  merma_pct: string | null;
  merma_excede_tolerancia: boolean;
};

export function ViajesChofer({ viajes }: { viajes: FilaViaje[] }) {
  if (viajes.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin viajes registrados.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {viajes.map((v) => (
        <li key={v.id}>
          <Link
            href={`/viajes/${v.id}`}
            className="flex items-center justify-between rounded-md border p-3 hover:bg-accent"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                #{v.numero} — {v.cliente_nombre ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {v.fecha_carga ? formatoFecha.format(v.fecha_carga) : "Sin fecha de carga"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {v.merma_pct && (
                <span className="text-xs text-muted-foreground">
                  Merma {Number(v.merma_pct).toFixed(2)}%
                </span>
              )}
              {v.merma_excede_tolerancia && <Badge variant="destructive">Merma</Badge>}
              <Badge variant="outline">{ETIQUETAS_ESTADO[v.estado] ?? v.estado}</Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
