"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeActivo } from "@/components/catalogos/badge-activo";
import { tipoAdicionalSchema, type TipoAdicionalInput } from "@/lib/schemas/catalogos";
import { actualizarTipoAdicional, crearTipoAdicional, eliminarTipoAdicional } from "../actions";

type Fila = {
  id: number;
  nombre: string;
  a_cargo_default: "cliente" | "empresa" | null;
  activo: boolean;
};

const valoresPorDefecto: TipoAdicionalInput = {
  nombre: "",
  a_cargo_default: undefined,
  activo: true,
};

const opcionesACargo = [
  { value: "cliente", label: "Cliente" },
  { value: "empresa", label: "Empresa" },
];

export function TabTiposAdicional({ filas }: { filas: Fila[] }) {
  return (
    <AbmCatalogoSimple<Fila, TipoAdicionalInput>
      titulo="tipo de adicional"
      filas={filas}
      etiquetaFila={(f) => f.nombre}
      resolver={zodResolver(tipoAdicionalSchema)}
      valoresPorDefecto={valoresPorDefecto}
      aValoresFormulario={(f) => ({
        nombre: f.nombre,
        a_cargo_default: f.a_cargo_default ?? undefined,
        activo: f.activo,
      })}
      columnas={[
        { accessorKey: "nombre", header: "Nombre" },
        {
          accessorKey: "a_cargo_default",
          header: "A cargo por defecto",
          cell: ({ getValue }) => {
            const v = getValue() as string | null;
            return v ? (v === "cliente" ? "Cliente" : "Empresa") : "—";
          },
        },
        {
          accessorKey: "activo",
          header: "Estado",
          cell: ({ getValue }) => <BadgeActivo activo={getValue() as boolean} />,
        },
      ]}
      campos={(form) => (
        <>
          <CampoTexto form={form} name="nombre" label="Nombre" />
          <CampoSelect
            form={form}
            name="a_cargo_default"
            label="A cargo por defecto"
            opciones={opcionesACargo}
          />
          <CampoBooleano form={form} name="activo" label="Activo" />
        </>
      )}
      crear={crearTipoAdicional}
      actualizar={actualizarTipoAdicional}
      eliminar={eliminarTipoAdicional}
    />
  );
}
