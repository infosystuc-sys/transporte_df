import type { Metadata } from "next";
import { FiltroReportes } from "./_componentes/filtro-reportes";

export const metadata: Metadata = {
  title: "Reportes — Gestión de Fletes",
};

export default function ReportesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Reportes</h1>
      <FiltroReportes />
    </div>
  );
}
