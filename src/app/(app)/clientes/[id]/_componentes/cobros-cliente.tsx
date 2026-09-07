import Link from "next/link";
import { Button } from "@/components/ui/button";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

type FilaCobro = {
  id: number;
  fecha: Date;
  medio_pago_nombre: string | null;
  importe: string;
  referencia: string | null;
};

export function CobrosCliente({
  clienteId,
  cobros,
}: {
  clienteId: number;
  cobros: FilaCobro[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href={`/cobros/nuevo?cliente_id=${clienteId}`}>Nuevo cobro</Link>
        </Button>
      </div>

      {cobros.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin cobros registrados.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cobros.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium">{c.medio_pago_nombre ?? "—"}</span>
                {c.referencia && <span className="text-sm text-muted-foreground">{c.referencia}</span>}
                <span className="text-xs text-muted-foreground">{formatoFecha.format(c.fecha)}</span>
              </div>
              <span className="font-medium">{formatoARS.format(Number(c.importe))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
