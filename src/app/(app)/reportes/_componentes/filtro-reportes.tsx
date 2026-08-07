"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function construirUrl(base: string, fechaDesde: string, fechaHasta: string) {
  const params = new URLSearchParams();
  if (fechaDesde) params.set("fecha_desde", fechaDesde);
  if (fechaHasta) params.set("fecha_hasta", fechaHasta);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function FiltroReportes() {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fecha_desde">Desde</Label>
          <Input
            id="fecha_desde"
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="fecha_hasta">Hasta</Label>
          <Input
            id="fecha_hasta"
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground sm:pb-2">
          Dejá vacío para incluir todo el histórico. Para viajes, &ldquo;Desde/Hasta&rdquo; filtra por
          fecha de carga.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">Viajes</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href={construirUrl("/api/reportes/viajes", fechaDesde, fechaHasta)}>Exportar a Excel</a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">Cobros</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href={construirUrl("/api/reportes/cobros", fechaDesde, fechaHasta)}>Exportar a Excel</a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Liquidaciones a choferes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href={construirUrl("/api/reportes/liquidaciones", fechaDesde, fechaHasta)}>
                Exportar a Excel
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
