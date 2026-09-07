import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

const ETIQUETAS_ESTADO: Record<string, string> = {
  planificado: "Planificado",
  cargado: "Cargado",
  en_transito: "En tránsito",
  descargado: "Descargado",
  facturado: "Facturado",
  cobrado: "Cobrado",
  liquidado: "Liquidado",
  rechazado: "Rechazado",
};

type FilaViaje = {
  id: number;
  numero: number;
  fecha_carga: Date | null;
  estado: string;
  dominio_tractor: string | null;
  chofer_nombre: string | null;
  total_a_cobrar: string | null;
  saldo_pendiente: string | null;
};

export function ViajesCliente({ viajes }: { viajes: FilaViaje[] }) {
  if (viajes.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin viajes registrados.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {viajes.map((v) => (
        <li key={v.id}>
          <Link
            href={`/viajes/${v.id}`}
            className="flex items-center justify-between gap-4 rounded-md border p-3 hover:bg-accent"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                #{v.numero} — {v.dominio_tractor ?? "—"} · {v.chofer_nombre ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {v.fecha_carga ? formatoFecha.format(v.fecha_carga) : "Sin fecha de carga"}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-medium">{formatoARS.format(Number(v.total_a_cobrar ?? 0))}</span>
              <div className="flex items-center gap-2">
                {Number(v.saldo_pendiente ?? 0) > 0 && (
                  <span className="text-xs text-destructive">
                    Pendiente {formatoARS.format(Number(v.saldo_pendiente))}
                  </span>
                )}
                <Badge variant="outline">{ETIQUETAS_ESTADO[v.estado] ?? v.estado}</Badge>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
