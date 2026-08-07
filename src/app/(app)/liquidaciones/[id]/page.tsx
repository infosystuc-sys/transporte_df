import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  choferes,
  liquidacionesChofer,
  liquidacionViajes,
  mediosPago,
  movimientosChofer,
  viajes,
} from "@/db/schema";
import { Button } from "@/components/ui/button";
import { BotonMarcarPagada } from "./_componentes/boton-marcar-pagada";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

const ETIQUETAS_TIPO: Record<string, string> = {
  adelanto: "Adelanto",
  gasoil: "Gasoil a cuenta",
  gasto_rendido: "Gasto rendido",
  liquidacion: "Liquidación",
  devolucion: "Devolución",
  ajuste: "Ajuste",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Liquidación #${id} — Gestión de Fletes` };
}

export default async function LiquidacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const [liq] = await db
    .select({
      id: liquidacionesChofer.id,
      chofer_id: liquidacionesChofer.chofer_id,
      chofer_nombre: choferes.nombre_completo,
      fecha: liquidacionesChofer.fecha,
      periodo_desde: liquidacionesChofer.periodo_desde,
      periodo_hasta: liquidacionesChofer.periodo_hasta,
      total_viajes: liquidacionesChofer.total_viajes,
      total_adelantos: liquidacionesChofer.total_adelantos,
      total_neto: liquidacionesChofer.total_neto,
      pagado: liquidacionesChofer.pagado,
      medio_pago_nombre: mediosPago.nombre,
      observaciones: liquidacionesChofer.observaciones,
    })
    .from(liquidacionesChofer)
    .leftJoin(choferes, eq(liquidacionesChofer.chofer_id, choferes.id))
    .leftJoin(mediosPago, eq(liquidacionesChofer.medio_pago_id, mediosPago.id))
    .where(eq(liquidacionesChofer.id, id));
  if (!liq) notFound();

  const [filasViajes, filasMovimientos, filasMediosPago] = await Promise.all([
    db
      .select({
        id: viajes.id,
        numero: viajes.numero,
        fecha_carga: viajes.fecha_carga,
        importe: liquidacionViajes.importe,
      })
      .from(liquidacionViajes)
      .innerJoin(viajes, eq(liquidacionViajes.viaje_id, viajes.id))
      .where(eq(liquidacionViajes.liquidacion_id, id)),
    db
      .select()
      .from(movimientosChofer)
      .where(eq(movimientosChofer.liquidacion_id, id)),
    db.select({ id: mediosPago.id, nombre: mediosPago.nombre }).from(mediosPago),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Liquidación #{liq.id}</h1>
          <p className="text-sm text-muted-foreground">{liq.chofer_nombre}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/liquidaciones">Volver al listado</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Fecha</p>
          <p>{formatoFecha.format(liq.fecha)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Viajes incluidos</p>
          <p>{liq.total_viajes ?? 0}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Deducciones</p>
          <p>{liq.total_adelantos ? formatoARS.format(Number(liq.total_adelantos)) : "—"}</p>
        </div>
        <div>
          <p className="font-medium text-muted-foreground">Total neto</p>
          <p className="font-medium">{liq.total_neto ? formatoARS.format(Number(liq.total_neto)) : "—"}</p>
        </div>
      </div>

      {liq.observaciones && <p className="text-sm text-muted-foreground">{liq.observaciones}</p>}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Viajes</h3>
        {filasViajes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin viajes incluidos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filasViajes.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <Link href={`/viajes/${v.id}`} className="text-primary hover:underline">
                  #{v.numero}
                  {v.fecha_carga && ` — ${formatoFecha.format(v.fecha_carga)}`}
                </Link>
                <span>{formatoARS.format(Number(v.importe ?? 0))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Movimientos de cuenta corriente</h3>
        {filasMovimientos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos incluidos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filasMovimientos.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>
                  {ETIQUETAS_TIPO[m.tipo] ?? m.tipo}
                  {m.descripcion && ` — ${m.descripcion}`}
                </span>
                <span>{formatoARS.format(Number(m.importe))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BotonMarcarPagada
        liquidacionId={liq.id}
        pagado={liq.pagado}
        medioPagoActual={liq.medio_pago_nombre}
        medioPagos={filasMediosPago}
      />
    </div>
  );
}
