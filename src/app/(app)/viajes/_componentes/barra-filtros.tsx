"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Opcion = { id: number; nombre: string };

const ESTADOS: { value: string; label: string }[] = [
  { value: "planificado", label: "Planificado" },
  { value: "cargado", label: "Cargado" },
  { value: "en_transito", label: "En tránsito" },
  { value: "descargado", label: "Descargado" },
  { value: "facturado", label: "Facturado" },
  { value: "cobrado", label: "Cobrado" },
  { value: "liquidado", label: "Liquidado" },
];

const CAMPOS_TEXTO = ["q", "fecha_desde", "fecha_hasta"] as const;
const CAMPOS_SELECT = [
  "estado",
  "cliente_id",
  "chofer_id",
  "camion_id",
  "producto_id",
  "origen_id",
  "destino_id",
] as const;
const CAMPOS_BOOL = ["merma", "pendiente_cobro"] as const;

type Filtros = Record<(typeof CAMPOS_TEXTO)[number] | (typeof CAMPOS_SELECT)[number], string> &
  Record<(typeof CAMPOS_BOOL)[number], boolean>;

export function BarraFiltros({
  clientes,
  choferes,
  camiones,
  productos,
  lugares,
}: {
  clientes: Opcion[];
  choferes: Opcion[];
  camiones: Opcion[];
  productos: Opcion[];
  lugares: Opcion[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filtros, setFiltros] = useState<Filtros>(() => {
    const f = {} as Filtros;
    for (const c of CAMPOS_TEXTO) f[c] = searchParams.get(c) ?? "";
    for (const c of CAMPOS_SELECT) f[c] = searchParams.get(c) ?? "todos";
    for (const c of CAMPOS_BOOL) f[c] = searchParams.get(c) === "1";
    return f;
  });

  function set<K extends keyof Filtros>(clave: K, valor: Filtros[K]) {
    setFiltros((prev) => ({ ...prev, [clave]: valor }));
  }

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const c of CAMPOS_TEXTO) if (filtros[c]) params.set(c, filtros[c]);
    for (const c of CAMPOS_SELECT) if (filtros[c] && filtros[c] !== "todos") params.set(c, filtros[c]);
    for (const c of CAMPOS_BOOL) if (filtros[c]) params.set(c, "1");
    router.push(`/viajes?${params.toString()}`);
  }

  function limpiar() {
    setFiltros({
      q: "",
      fecha_desde: "",
      fecha_hasta: "",
      estado: "todos",
      cliente_id: "todos",
      chofer_id: "todos",
      camion_id: "todos",
      producto_id: "todos",
      origen_id: "todos",
      destino_id: "todos",
      merma: false,
      pendiente_cobro: false,
    });
    router.push("/viajes");
  }

  return (
    <form onSubmit={aplicar} className="flex flex-col gap-4 rounded-md border p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q">Buscar (CTG / CPE / dominio)</Label>
          <Input id="q" value={filtros.q} onChange={(e) => set("q", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fecha_desde">Fecha desde</Label>
          <Input
            id="fecha_desde"
            type="date"
            value={filtros.fecha_desde}
            onChange={(e) => set("fecha_desde", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fecha_hasta">Fecha hasta</Label>
          <Input
            id="fecha_hasta"
            type="date"
            value={filtros.fecha_hasta}
            onChange={(e) => set("fecha_hasta", e.target.value)}
          />
        </div>

        <SelectFiltro
          etiqueta="Estado"
          valor={filtros.estado}
          onChange={(v) => set("estado", v)}
          opciones={ESTADOS}
        />
        <SelectFiltro
          etiqueta="Cliente"
          valor={filtros.cliente_id}
          onChange={(v) => set("cliente_id", v)}
          opciones={clientes.map((c) => ({ value: String(c.id), label: c.nombre }))}
        />
        <SelectFiltro
          etiqueta="Chofer"
          valor={filtros.chofer_id}
          onChange={(v) => set("chofer_id", v)}
          opciones={choferes.map((c) => ({ value: String(c.id), label: c.nombre }))}
        />
        <SelectFiltro
          etiqueta="Camión"
          valor={filtros.camion_id}
          onChange={(v) => set("camion_id", v)}
          opciones={camiones.map((c) => ({ value: String(c.id), label: c.nombre }))}
        />
        <SelectFiltro
          etiqueta="Producto"
          valor={filtros.producto_id}
          onChange={(v) => set("producto_id", v)}
          opciones={productos.map((p) => ({ value: String(p.id), label: p.nombre }))}
        />
        <SelectFiltro
          etiqueta="Origen"
          valor={filtros.origen_id}
          onChange={(v) => set("origen_id", v)}
          opciones={lugares.map((l) => ({ value: String(l.id), label: l.nombre }))}
        />
        <SelectFiltro
          etiqueta="Destino"
          valor={filtros.destino_id}
          onChange={(v) => set("destino_id", v)}
          opciones={lugares.map((l) => ({ value: String(l.id), label: l.nombre }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={filtros.merma} onCheckedChange={(v) => set("merma", !!v)} />
          Solo con merma excedida
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={filtros.pendiente_cobro}
            onCheckedChange={(v) => set("pendiente_cobro", !!v)}
          />
          Solo pendientes de cobro
        </label>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={limpiar}>
            Limpiar filtros
          </Button>
          <Button type="submit">Aplicar</Button>
        </div>
      </div>
    </form>
  );
}

function SelectFiltro({
  etiqueta,
  valor,
  onChange,
  opciones,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{etiqueta}</Label>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {opciones.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
