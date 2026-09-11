import Link from "next/link";
import { Button } from "@/components/ui/button";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

type FilaViajePendiente = {
  id: number;
  numero: number;
  fecha_carga: Date | null;
  total_a_cobrar: string | null;
  importe_cobrado: string | null;
  saldo_pendiente: string | null;
  facturado: boolean;
  factura_importe_total: string | null;
};

export function CuentaCorrienteCliente({
  clienteId,
  viajesPendientes,
  saldoTotal,
}: {
  clienteId: number;
  viajesPendientes: FilaViajePendiente[];
  saldoTotal: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-md border p-4">
        <div>
          <p className="text-sm text-muted-foreground">Saldo pendiente de cobro</p>
          <p className="text-[20px] font-extrabold">{formatoARS.format(saldoTotal)}</p>
        </div>
        <Button asChild>
          <Link href={`/cobros/nuevo?cliente_id=${clienteId}`}>Nuevo cobro</Link>
        </Button>
      </div>

      {viajesPendientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin viajes pendientes de cobro.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {viajesPendientes.map((v) => (
            <li key={v.id}>
              <Link
                href={`/viajes/${v.id}`}
                className="flex items-center justify-between gap-4 rounded-md border p-3 hover:bg-accent"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">#{v.numero}</span>
                  <span className="text-xs text-muted-foreground">
                    {v.fecha_carga ? formatoFecha.format(v.fecha_carga) : "Sin fecha de carga"}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-medium">
                    {formatoARS.format(Number(v.saldo_pendiente ?? 0))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    de{" "}
                    {formatoARS.format(
                      Number((v.facturado ? v.factura_importe_total : null) ?? v.total_a_cobrar ?? 0)
                    )}
                    {v.facturado && v.factura_importe_total != null && " (c/IVA)"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
