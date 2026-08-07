"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Opcion = { id: number; nombre: string };

export function FiltrosGasoil({ camiones, estaciones }: { camiones: Opcion[]; estaciones: Opcion[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [camionId, setCamionId] = useState(searchParams.get("camion_id") ?? "todos");
  const [estacionId, setEstacionId] = useState(searchParams.get("estacion_id") ?? "todos");
  const [fechaDesde, setFechaDesde] = useState(searchParams.get("fecha_desde") ?? "");
  const [fechaHasta, setFechaHasta] = useState(searchParams.get("fecha_hasta") ?? "");

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (camionId !== "todos") params.set("camion_id", camionId);
    if (estacionId !== "todos") params.set("estacion_id", estacionId);
    if (fechaDesde) params.set("fecha_desde", fechaDesde);
    if (fechaHasta) params.set("fecha_hasta", fechaHasta);
    router.push(`/gasoil?${params.toString()}`);
  }

  function limpiar() {
    setCamionId("todos");
    setEstacionId("todos");
    setFechaDesde("");
    setFechaHasta("");
    router.push("/gasoil");
  }

  return (
    <form onSubmit={aplicar} className="flex flex-wrap items-end gap-3 rounded-md border p-4">
      <div className="flex flex-col gap-1.5">
        <Label>Camión</Label>
        <Select value={camionId} onValueChange={setCamionId}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {camiones.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Estación</Label>
        <Select value={estacionId} onValueChange={setEstacionId}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {estaciones.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fecha_desde">Desde</Label>
        <Input id="fecha_desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fecha_hasta">Hasta</Label>
        <Input id="fecha_hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={limpiar}>
          Limpiar
        </Button>
        <Button type="submit">Aplicar</Button>
      </div>
    </form>
  );
}
