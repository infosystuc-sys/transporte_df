import type { Metadata } from "next";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, mediosPago, viajes } from "@/db/schema";
import { FormularioCobro } from "./_componentes/formulario-cobro";

export const metadata: Metadata = {
  title: "Nuevo cobro — Gestión de Fletes",
};

export default async function NuevoCobroPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente_id?: string }>;
}) {
  const sp = await searchParams;
  const clienteId = sp.cliente_id ? Number(sp.cliente_id) : undefined;

  const [filasClientes, filasMediosPago, viajesPendientes] = await Promise.all([
    db
      .select({ id: clientes.id, nombre: clientes.razon_social })
      .from(clientes)
      .orderBy(asc(clientes.razon_social)),
    db.select({ id: mediosPago.id, nombre: mediosPago.nombre }).from(mediosPago),
    clienteId
      ? db
          .select({
            id: viajes.id,
            numero: viajes.numero,
            factura_nro: viajes.factura_nro,
            fecha_vto_cobro: viajes.fecha_vto_cobro,
            saldo_pendiente: viajes.saldo_pendiente,
          })
          .from(viajes)
          .where(
            and(
              eq(viajes.facturado, true),
              // El pagador es viajes.pagador_id si está, si no viajes.cliente_id.
              sql`coalesce(${viajes.pagador_id}, ${viajes.cliente_id}) = ${clienteId}`,
              or(isNull(viajes.saldo_pendiente), gt(viajes.saldo_pendiente, "0"))
            )
          )
          .orderBy(asc(viajes.fecha_vto_cobro))
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Nuevo cobro</h1>
      <FormularioCobro
        clientes={filasClientes}
        medioPagos={filasMediosPago}
        clienteId={clienteId}
        viajesPendientes={viajesPendientes}
      />
    </div>
  );
}
