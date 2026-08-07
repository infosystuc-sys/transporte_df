"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeVigencia } from "@/components/catalogos/badge-vigencia";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tarifaSchema, type TarifaInput } from "@/lib/schemas/tarifas";
import { formatoFechaInput } from "@/lib/schemas/campos-fecha";
import { crearTarifa, actualizarTarifa, eliminarTarifa } from "../actions";

type ModalidadTarifa = "por_tonelada" | "por_km" | "por_tonelada_km" | "monto_fijo";

type Fila = {
  id: number;
  cliente_id: number;
  origen_id: number | null;
  destino_id: number | null;
  producto_id: number | null;
  km: number | null;
  modalidad_tarifa: ModalidadTarifa | null;
  valor: string;
  vigencia_desde: Date;
  vigencia_hasta: Date | null;
  activo: boolean;
  observaciones: string | null;
};

type Opcion = { id: number; nombre: string };

const valoresPorDefecto: TarifaInput = {
  cliente_id: undefined as unknown as number,
  origen_id: undefined,
  destino_id: undefined,
  producto_id: undefined,
  km: undefined,
  modalidad_tarifa: "por_tonelada",
  valor: "",
  vigencia_desde: formatoFechaInput(new Date()) as unknown as Date,
  vigencia_hasta: undefined,
  activo: true,
  observaciones: "",
};

const opcionesModalidad: { value: ModalidadTarifa; label: string }[] = [
  { value: "por_tonelada", label: "Por tonelada" },
  { value: "por_km", label: "Por km" },
  { value: "por_tonelada_km", label: "Por tonelada-km" },
  { value: "monto_fijo", label: "Monto fijo" },
];

export function GestorTarifas({
  filas,
  clientes,
  lugares,
  productos,
}: {
  filas: Fila[];
  clientes: Opcion[];
  lugares: Opcion[];
  productos: Opcion[];
}) {
  const [clienteFiltro, setClienteFiltro] = useState<string>("todos");

  const nombreCliente = useMemo(() => {
    const m = new Map(clientes.map((c) => [c.id, c.nombre]));
    return (id: number) => m.get(id) ?? "—";
  }, [clientes]);
  const nombreLugar = useMemo(() => {
    const m = new Map(lugares.map((l) => [l.id, l.nombre]));
    return (id: number | null) => (id ? (m.get(id) ?? "—") : "Cualquiera");
  }, [lugares]);
  const nombreProducto = useMemo(() => {
    const m = new Map(productos.map((p) => [p.id, p.nombre]));
    return (id: number | null) => (id ? (m.get(id) ?? "—") : "Cualquiera");
  }, [productos]);

  const filasFiltradas =
    clienteFiltro === "todos"
      ? filas
      : filas.filter((f) => String(f.cliente_id) === clienteFiltro);

  const opcionesSelect = (lista: Opcion[]) =>
    lista.map((o) => ({ value: String(o.id), label: o.nombre }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Cliente</span>
        <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los clientes</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AbmCatalogoSimple<Fila, TarifaInput>
        titulo="tarifa"
        filas={filasFiltradas}
        etiquetaFila={(f) => `${nombreCliente(f.cliente_id)} — ${nombreLugar(f.origen_id)} → ${nombreLugar(f.destino_id)}`}
        resolver={zodResolver(tarifaSchema)}
        valoresPorDefecto={valoresPorDefecto}
        aValoresFormulario={(f) => ({
          cliente_id: f.cliente_id,
          origen_id: f.origen_id ?? undefined,
          destino_id: f.destino_id ?? undefined,
          producto_id: f.producto_id ?? undefined,
          km: f.km ?? undefined,
          modalidad_tarifa: f.modalidad_tarifa ?? "por_tonelada",
          valor: f.valor,
          vigencia_desde: formatoFechaInput(f.vigencia_desde) as unknown as Date,
          vigencia_hasta: formatoFechaInput(f.vigencia_hasta) as unknown as Date,
          activo: f.activo,
          observaciones: f.observaciones ?? "",
        })}
        alDuplicar={(f) => ({
          cliente_id: f.cliente_id,
          origen_id: f.origen_id ?? undefined,
          destino_id: f.destino_id ?? undefined,
          producto_id: f.producto_id ?? undefined,
          km: f.km ?? undefined,
          modalidad_tarifa: f.modalidad_tarifa ?? "por_tonelada",
          valor: f.valor,
          // Duplicar para el período siguiente: arranca hoy, sin vencimiento.
          vigencia_desde: formatoFechaInput(new Date()) as unknown as Date,
          vigencia_hasta: undefined,
          activo: true,
          observaciones: f.observaciones ?? "",
        })}
        columnas={[
          {
            accessorKey: "cliente_id",
            header: "Cliente",
            cell: ({ getValue }) => nombreCliente(getValue() as number),
          },
          {
            accessorKey: "origen_id",
            header: "Origen",
            cell: ({ getValue }) => nombreLugar(getValue() as number | null),
          },
          {
            accessorKey: "destino_id",
            header: "Destino",
            cell: ({ getValue }) => nombreLugar(getValue() as number | null),
          },
          {
            accessorKey: "producto_id",
            header: "Producto",
            cell: ({ getValue }) => nombreProducto(getValue() as number | null),
          },
          { accessorKey: "valor", header: "Valor" },
          {
            id: "vigencia",
            header: "Vigencia",
            cell: ({ row }) => (
              <BadgeVigencia
                activo={row.original.activo}
                desde={row.original.vigencia_desde}
                hasta={row.original.vigencia_hasta}
              />
            ),
          },
        ]}
        campos={(form) => (
          <>
            <CampoSelect
              form={form}
              name="cliente_id"
              label="Cliente"
              opciones={opcionesSelect(clientes)}
            />
            <CampoSelect
              form={form}
              name="producto_id"
              label="Producto (vacío = cualquiera)"
              opciones={opcionesSelect(productos)}
              placeholder="Cualquiera"
            />
            <CampoSelect
              form={form}
              name="origen_id"
              label="Origen"
              opciones={opcionesSelect(lugares)}
              placeholder="Cualquiera"
            />
            <CampoSelect
              form={form}
              name="destino_id"
              label="Destino"
              opciones={opcionesSelect(lugares)}
              placeholder="Cualquiera"
            />
            <CampoSelect
              form={form}
              name="modalidad_tarifa"
              label="Modalidad"
              opciones={opcionesModalidad}
            />
            <CampoTexto form={form} name="valor" label="Valor ($)" />
            <CampoTexto form={form} name="km" label="Km" tipo="number" />
            <CampoTexto form={form} name="vigencia_desde" label="Vigencia desde" tipo="date" />
            <CampoTexto
              form={form}
              name="vigencia_hasta"
              label="Vigencia hasta (vacío = sin vencimiento)"
              tipo="date"
            />
            <CampoBooleano form={form} name="activo" label="Activo" />
            <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />
          </>
        )}
        crear={crearTarifa}
        actualizar={actualizarTarifa}
        eliminar={eliminarTarifa}
      />
    </div>
  );
}
