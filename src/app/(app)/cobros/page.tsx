import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, cobros, mediosPago } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { TablaCobros } from "./_componentes/tabla-cobros";

export const metadata: Metadata = {
  title: "Cobros — Gestión de Fletes",
};

export default async function CobrosPage() {
  const filas = await db
    .select({
      id: cobros.id,
      fecha: cobros.fecha,
      cliente_nombre: clientes.razon_social,
      medio_pago_nombre: mediosPago.nombre,
      importe: cobros.importe,
      referencia: cobros.referencia,
    })
    .from(cobros)
    .leftJoin(clientes, eq(cobros.cliente_id, clientes.id))
    .leftJoin(mediosPago, eq(cobros.medio_pago_id, mediosPago.id))
    .orderBy(desc(cobros.fecha));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Cobros</h1>
        <Button asChild>
          <Link href="/cobros/nuevo">Nuevo cobro</Link>
        </Button>
      </div>
      <TablaCobros filas={filas} />
    </div>
  );
}
