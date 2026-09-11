import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, cobros, mediosPago, viajes } from "@/db/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CuentaCorrienteCliente } from "./_componentes/cuenta-corriente-cliente";
import { ViajesCliente } from "./_componentes/viajes-cliente";
import { CobrosCliente } from "./_componentes/cobros-cliente";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Cliente #${id} — Gestión de Fletes` };
}

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id));
  if (!cliente) notFound();

  const [viajesConDetalle, viajesPendientes, filasCobros] = await Promise.all([
    db
      .select({
        id: viajes.id,
        numero: viajes.numero,
        fecha_carga: viajes.fecha_carga,
        estado: viajes.estado,
        dominio_tractor: camiones.dominio_tractor,
        chofer_nombre: choferes.nombre_completo,
        total_a_cobrar: viajes.total_a_cobrar,
        saldo_pendiente: viajes.saldo_pendiente,
        facturado: viajes.facturado,
      })
      .from(viajes)
      .leftJoin(camiones, eq(viajes.camion_id, camiones.id))
      .leftJoin(choferes, eq(viajes.chofer_id, choferes.id))
      .where(eq(viajes.cliente_id, id))
      .orderBy(desc(viajes.fecha_carga)),
    db
      .select({
        id: viajes.id,
        numero: viajes.numero,
        fecha_carga: viajes.fecha_carga,
        total_a_cobrar: viajes.total_a_cobrar,
        importe_cobrado: viajes.importe_cobrado,
        saldo_pendiente: viajes.saldo_pendiente,
      })
      .from(viajes)
      .where(and(eq(viajes.cliente_id, id), gt(viajes.saldo_pendiente, "0")))
      .orderBy(desc(viajes.fecha_carga)),
    db
      .select({
        id: cobros.id,
        fecha: cobros.fecha,
        medio_pago_nombre: mediosPago.nombre,
        importe: cobros.importe,
        referencia: cobros.referencia,
      })
      .from(cobros)
      .leftJoin(mediosPago, eq(cobros.medio_pago_id, mediosPago.id))
      .where(eq(cobros.cliente_id, id))
      .orderBy(desc(cobros.fecha)),
  ]);

  const saldoTotal = viajesPendientes.reduce((s, v) => s + Number(v.saldo_pendiente ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">{cliente.razon_social}</h1>
        <Button variant="outline" asChild>
          <Link href="/clientes">Volver al listado</Link>
        </Button>
      </div>

      <Tabs defaultValue="cuenta">
        <TabsList>
          <TabsTrigger value="cuenta">Cuenta corriente</TabsTrigger>
          <TabsTrigger value="viajes">Viajes realizados</TabsTrigger>
          <TabsTrigger value="cobros">Cobros</TabsTrigger>
        </TabsList>
        <TabsContent value="cuenta">
          <CuentaCorrienteCliente
            clienteId={id}
            viajesPendientes={viajesPendientes}
            saldoTotal={saldoTotal}
          />
        </TabsContent>
        <TabsContent value="viajes">
          <ViajesCliente viajes={viajesConDetalle} />
        </TabsContent>
        <TabsContent value="cobros">
          <CobrosCliente clienteId={id} cobros={filasCobros} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
