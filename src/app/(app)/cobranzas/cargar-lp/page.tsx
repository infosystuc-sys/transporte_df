import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CargadorLp } from "./_componentes/cargador-lp";

export const metadata: Metadata = {
  title: "Cargar líquidos producto — Gestión de Fletes",
};

// La lectura por IA (si el LP no trae texto) puede pasar el límite por
// defecto de una Server Action. Ver viajes/importar-cpe/page.tsx.
export const maxDuration = 60;

export default function CargarLpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-black tracking-[-0.01em]">Cargar líquidos producto</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Subí todos los líquidos producto que mandan los clientes. Cada uno se lee solo, se busca cada
            Carta de Porte en Viajes y se vincula con su viaje, que queda facturado con ese LP. Si los
            kilos, la tarifa o el flete no coinciden con lo cargado, el viaje se vincula igual y queda con
            un aviso en Cobranzas para revisarlo.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/cobranzas">Ir a Cobranzas</Link>
        </Button>
      </div>
      <CargadorLp />
    </div>
  );
}
