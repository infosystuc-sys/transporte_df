import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard — Gestión de Fletes",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Fase 1 completa</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          El login y la estructura base están listos. Los contadores, alertas
          y gráficos de esta pantalla se construyen en la Fase 12.
        </CardContent>
      </Card>
    </div>
  );
}
