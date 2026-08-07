"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeActivo } from "@/components/catalogos/badge-activo";
import { lugarSchema, type LugarInput } from "@/lib/schemas/lugares";
import { actualizarLugar, crearLugar, eliminarLugar } from "../actions";

type Fila = {
  id: number;
  nombre: string;
  tipo: "campo" | "planta" | "acopio" | "puerto" | "otro" | null;
  localidad: string | null;
  provincia: string | null;
  direccion: string | null;
  n_planta: string | null;
  renspa: string | null;
  latitud: number | null;
  longitud: number | null;
  cliente_id: number | null;
  observaciones: string | null;
  activo: boolean;
  aliases: string[];
};

const opcionesTipo = [
  { value: "campo", label: "Campo" },
  { value: "planta", label: "Planta" },
  { value: "acopio", label: "Acopio" },
  { value: "puerto", label: "Puerto" },
  { value: "otro", label: "Otro" },
];

const valoresPorDefecto: LugarInput = {
  nombre: "",
  tipo: undefined,
  localidad: "",
  provincia: "",
  direccion: "",
  n_planta: "",
  renspa: "",
  latitud: undefined,
  longitud: undefined,
  cliente_id: undefined,
  observaciones: "",
  activo: true,
  alias: "",
};

export function TabLugares({
  filas,
  clientes,
}: {
  filas: Fila[];
  clientes: { id: number; razon_social: string }[];
}) {
  const opcionesCliente = clientes.map((c) => ({ value: String(c.id), label: c.razon_social }));

  return (
    <AbmCatalogoSimple<Fila, LugarInput>
      titulo="lugar"
      filas={filas}
      etiquetaFila={(f) => f.nombre}
      resolver={zodResolver(lugarSchema)}
      valoresPorDefecto={valoresPorDefecto}
      aValoresFormulario={(f) => ({
        nombre: f.nombre,
        tipo: f.tipo ?? undefined,
        localidad: f.localidad ?? "",
        provincia: f.provincia ?? "",
        direccion: f.direccion ?? "",
        n_planta: f.n_planta ?? "",
        renspa: f.renspa ?? "",
        latitud: f.latitud ?? undefined,
        longitud: f.longitud ?? undefined,
        cliente_id: f.cliente_id ?? undefined,
        observaciones: f.observaciones ?? "",
        activo: f.activo,
        alias: f.aliases.join("\n"),
      })}
      columnas={[
        { accessorKey: "nombre", header: "Nombre" },
        {
          accessorKey: "tipo",
          header: "Tipo",
          cell: ({ getValue }) => {
            const v = getValue() as string | null;
            return opcionesTipo.find((o) => o.value === v)?.label ?? "—";
          },
        },
        { accessorKey: "localidad", header: "Localidad" },
        { accessorKey: "provincia", header: "Provincia" },
        {
          accessorKey: "activo",
          header: "Estado",
          cell: ({ getValue }) => <BadgeActivo activo={getValue() as boolean} />,
        },
      ]}
      campos={(form) => (
        <>
          <CampoTexto form={form} name="nombre" label="Nombre" />
          <CampoSelect form={form} name="tipo" label="Tipo" opciones={opcionesTipo} />
          <CampoTexto form={form} name="localidad" label="Localidad" />
          <CampoTexto form={form} name="provincia" label="Provincia" />
          <CampoTexto form={form} name="direccion" label="Dirección" />
          <CampoTexto form={form} name="n_planta" label="N° de planta" />
          <CampoTexto form={form} name="renspa" label="RENSPA" />
          <CampoTexto form={form} name="latitud" label="Latitud" tipo="text" />
          <CampoTexto form={form} name="longitud" label="Longitud" tipo="text" />
          <CampoSelect
            form={form}
            name="cliente_id"
            label="Cliente"
            opciones={opcionesCliente}
            placeholder="Ninguno"
          />
          <CampoTexto
            form={form}
            name="alias"
            label="Alias (uno por línea, para el buscador)"
            textarea
          />
          <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />
          <CampoBooleano form={form} name="activo" label="Activo" />
        </>
      )}
      crear={crearLugar}
      actualizar={actualizarLugar}
      eliminar={eliminarLugar}
    />
  );
}
