import type { Metadata } from "next";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { choferes, mediosPago, movimientosChofer, viajes } from "@/db/schema";
import { FormularioLiquidacion } from "./_componentes/formulario-liquidacion";

export const metadata: Metadata = {
  title: "Nueva liquidación — Gestión de Fletes",
};

export default async function NuevaLiquidacionPage({
  searchParams,
}: {
  searchParams: Promise<{ chofer_id?: string }>;
}) {
  const sp = await searchParams;
  const choferId = sp.chofer_id ? Number(sp.chofer_id) : undefined;

  const [filasChoferes, filasMediosPago, viajesPendientes, movimientosPendientes] =
    await Promise.all([
      db
        .select({ id: choferes.id, nombre: choferes.nombre_completo })
        .from(choferes)
        .orderBy(asc(choferes.nombre_completo)),
      db.select({ id: mediosPago.id, nombre: mediosPago.nombre }).from(mediosPago),
      choferId
        ? db
            .select({
              id: viajes.id,
              numero: viajes.numero,
              fecha_carga: viajes.fecha_carga,
              importe_liquidacion_chofer: viajes.importe_liquidacion_chofer,
            })
            .from(viajes)
            .where(
              and(
                eq(viajes.chofer_id, choferId),
                eq(viajes.liquidado, false),
                isNotNull(viajes.importe_liquidacion_chofer)
              )
            )
            .orderBy(asc(viajes.fecha_carga))
        : Promise.resolve([]),
      choferId
        ? db
            .select()
            .from(movimientosChofer)
            .where(and(eq(movimientosChofer.chofer_id, choferId), isNull(movimientosChofer.liquidacion_id)))
            .orderBy(asc(movimientosChofer.fecha))
        : Promise.resolve([]),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Nueva liquidación</h1>
      <FormularioLiquidacion
        choferes={filasChoferes}
        medioPagos={filasMediosPago}
        choferId={choferId}
        viajesPendientes={viajesPendientes}
        movimientosPendientes={movimientosPendientes}
      />
    </div>
  );
}
