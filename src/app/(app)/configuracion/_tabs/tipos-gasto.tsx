"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeActivo } from "@/components/catalogos/badge-activo";
import { tipoGastoSchema, type TipoGastoInput } from "@/lib/schemas/catalogos";
import { actualizarTipoGasto, crearTipoGasto, eliminarTipoGasto } from "../actions";

type Fila = { id: number; nombre: string; activo: boolean };

const valoresPorDefecto: TipoGastoInput = { nombre: "", activo: true };

export function TabTiposGasto({ filas }: { filas: Fila[] }) {
  return (
    <AbmCatalogoSimple<Fila, TipoGastoInput>
      titulo="tipo de gasto"
      filas={filas}
      etiquetaFila={(f) => f.nombre}
      resolver={zodResolver(tipoGastoSchema)}
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
      crear={crearTipoGasto}
      actualizar={actualizarTipoGasto}
      eliminar={eliminarTipoGasto}
    />
  );
}
