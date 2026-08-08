import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { camiones } from "@/db/schema";
import { GestorCamiones } from "./_componentes/gestor-camiones";

export const metadata: Metadata = {
  title: "Camiones — Gestión de Fletes",
};

export default async function CamionesPage() {
  const filas = await db.select().from(camiones).orderBy(asc(camiones.dominio_tractor));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Camiones</h1>
      <GestorCamiones filas={filas} />
    </div>
  );
}
