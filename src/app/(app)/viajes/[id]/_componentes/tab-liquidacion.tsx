import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const ETIQUETAS_MODALIDAD: Record<string, string> = {
  porcentaje_flete: "Porcentaje del flete",
  monto_fijo_viaje: "Monto fijo por viaje",
  por_tonelada: "Por tonelada",
  sueldo: "Sueldo (no se liquida por viaje)",
  sin_definir: "Sin definir",
};

/**
 * Solo lectura: el importe se calcula automáticamente según la modalidad
 * de pago del chofer (spec 1) y la asignación a una liquidación se hace
 * desde /liquidaciones, no desde acá — evita liquidar el mismo viaje dos
 * veces por caminos distintos.
 */
export function TabLiquidacion({
  choferNombre,
  modalidadPago,
  importeLiquidacionChofer,
  liquidado,
  liquidacionId,
}: {
  choferNombre: string | null;
  modalidadPago: string | null;
  importeLiquidacionChofer: string | null;
  liquidado: boolean;
  liquidacionId: number | null;
}) {
  if (!choferNombre) {
    return (
      <p className="text-sm text-muted-foreground">
        Asigná un chofer en Datos generales para calcular su liquidación.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Chofer</p>
          <p>{choferNombre}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Modalidad de pago</p>
          <p>{modalidadPago ? (ETIQUETAS_MODALIDAD[modalidadPago] ?? modalidadPago) : "—"}</p>
        </div>
        <div>
          <p className="font-medium text-muted-foreground">Importe a liquidar</p>
          <p className="font-medium">
            {importeLiquidacionChofer ? formatoARS.format(Number(importeLiquidacionChofer)) : "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={liquidado ? "secondary" : "outline"}>
          {liquidado ? "Liquidado" : "Pendiente de liquidar"}
        </Badge>
        {liquidado && liquidacionId && (
          <Link href={`/liquidaciones/${liquidacionId}`} className="text-sm text-primary hover:underline">
            Ver liquidación #{liquidacionId}
          </Link>
        )}
      </div>

      {!liquidado && (
        <p className="text-xs text-muted-foreground">
          Este importe se calcula solo y se actualiza mientras el viaje no esté incluido en una
          liquidación. Para liquidarlo, andá a{" "}
          <Link href="/liquidaciones/nueva" className="text-primary hover:underline">
            Liquidaciones → Nueva liquidación
          </Link>
          .
        </p>
      )}
    </div>
  );
}
