"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeActivo } from "@/components/catalogos/badge-activo";
import { tipoContingenciaSchema, type TipoContingenciaInput } from "@/lib/schemas/catalogos";
import {
  actualizarTipoContingencia,
  crearTipoContingencia,
  eliminarTipoContingencia,
} from "../actions";

type Fila = { id: number; nombre: string; activo: boolean };

const valoresPorDefecto: TipoContingenciaInput = { nombre: "", activo: true };

export function TabTiposContingencia({ filas }: { filas: Fila[] }) {
  return (
    <AbmCatalogoSimple<Fila, TipoContingenciaInput>
      titulo="tipo de contingencia"
      filas={filas}
      etiquetaFila={(f) => f.nombre}
      resolver={zodResolver(tipoContingenciaSchema)}
      valoresPorDefecto={valoresPorDefecto}
      aValoresFormulario={(f) => ({ nombre: f.nombre, activo: f.activo })}
      columnas={[
        { accessorKey: "nombre", header: "Nombre" },
        {
          accessorKey: "activo",
          header: "Estado",
          cell: ({ getValue }) => <BadgeActivo activo={getValue() as boolean} />,
        },
      ]}
      campos={(form) => (
        <>
          <CampoTexto form={form} name="nombre" label="Nombre" />
          <CampoBooleano form={form} name="activo" label="Activo" />
        </>
      )}
      crear={crearTipoContingencia}
      actualizar={actualizarTipoContingencia}
      eliminar={eliminarTipoContingencia}
    />
  );
}
