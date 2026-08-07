import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes } from "@/db/schema";
import { GestorChoferes } from "./_componentes/gestor-choferes";

export const metadata: Metadata = {
  title: "Choferes — Gestión de Fletes",
};

export default async function ChoferesPage() {
  const [filasChoferes, filasCamiones] = await Promise.all([
    db.select().from(choferes).orderBy(asc(choferes.nombre_completo)),
    db
      .select({ id: camiones.id, dominio_tractor: camiones.dominio_tractor })
      .from(camiones)
      .orderBy(asc(camiones.dominio_tractor)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Choferes</h1>
      <GestorChoferes filas={filasChoferes} camiones={filasCamiones} />
    </div>
  );
}
