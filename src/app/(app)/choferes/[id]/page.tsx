import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { choferes, clientes, liquidacionesChofer, mediosPago, movimientosChofer, viajes } from "@/db/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { calcularSaldo } from "@/lib/cuenta-corriente/signo";
import { CuentaCorriente } from "./_componentes/cuenta-corriente";
import { ViajesChofer } from "./_componentes/viajes-chofer";
import { LiquidacionesChofer } from "./_componentes/liquidaciones-chofer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Chofer #${id} — Gestión de Fletes` };
}

export default async function ChoferDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const [chofer] = await db.select().from(choferes).where(eq(choferes.id, id));
  if (!chofer) notFound();

  const [movimientos, filasMediosPago, viajesConCliente, filasLiquidaciones] = await Promise.all([
    db
      .select()
      .from(movimientosChofer)
      .where(eq(movimientosChofer.chofer_id, id))
      .orderBy(desc(movimientosChofer.fecha)),
    db.select({ id: mediosPago.id, nombre: mediosPago.nombre }).from(mediosPago),
    db
      .select({
        id: viajes.id,
        numero: viajes.numero,
        fecha_carga: viajes.fecha_carga,
        estado: viajes.estado,
        merma_pct: viajes.merma_pct,
        merma_excede_tolerancia: viajes.merma_excede_tolerancia,
        cliente_nombre: clientes.razon_social,
      })
      .from(viajes)
      .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
      .where(eq(viajes.chofer_id, id))
      .orderBy(desc(viajes.fecha_carga)),
    db
      .select()
      .from(liquidacionesChofer)
      .where(eq(liquidacionesChofer.chofer_id, id))
      .orderBy(desc(liquidacionesChofer.fecha)),
  ]);

  // El saldo mostrado es lo acumulado desde la última liquidación: lo ya
  // barrido (liquidacion_id != null) no vuelve a sumar acá.
  const saldoPendiente = calcularSaldo(movimientos.filter((m) => m.liquidacion_id == null));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">{chofer.nombre_completo}</h1>
        <Button variant="outline" asChild>
          <Link href="/choferes">Volver al listado</Link>
        </Button>
      </div>

      <Tabs defaultValue="cuenta">
        <TabsList>
          <TabsTrigger value="cuenta">Cuenta corriente</TabsTrigger>
          <TabsTrigger value="viajes">Viajes realizados</TabsTrigger>
          <TabsTrigger value="liquidaciones">Liquidaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="cuenta">
          <CuentaCorriente
            choferId={id}
            movimientos={movimientos}
            medioPagos={filasMediosPago}
            saldoPendiente={saldoPendiente}
          />
        </TabsContent>
        <TabsContent value="viajes">
          <ViajesChofer viajes={viajesConCliente} />
        </TabsContent>
        <TabsContent value="liquidaciones">
          <LiquidacionesChofer choferId={id} liquidaciones={filasLiquidaciones} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
