"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeActivo } from "@/components/catalogos/badge-activo";
import { estacionServicioSchema, type EstacionServicioInput } from "@/lib/schemas/catalogos";
import {
  actualizarEstacionServicio,
  crearEstacionServicio,
  eliminarEstacionServicio,
} from "../actions";

type Fila = {
  id: number;
  nombre: string;
  localidad: string | null;
  provincia: string | null;
  tiene_cuenta_corriente: boolean;
  observaciones: string | null;
  activo: boolean;
};

const valoresPorDefecto: EstacionServicioInput = {
  nombre: "",
  localidad: "",
  provincia: "",
  tiene_cuenta_corriente: false,
  observaciones: "",
  activo: true,
};

export function TabEstacionesServicio({ filas }: { filas: Fila[] }) {
  return (
    <AbmCatalogoSimple<Fila, EstacionServicioInput>
      titulo="estación de servicio"
      filas={filas}
      etiquetaFila={(f) => f.nombre}
      resolver={zodResolver(estacionServicioSchema)}
      valoresPorDefecto={valoresPorDefecto}
      aValoresFormulario={(f) => ({
        nombre: f.nombre,
        localidad: f.localidad ?? "",
        provincia: f.provincia ?? "",
        tiene_cuenta_corriente: f.tiene_cuenta_corriente,
        observaciones: f.observaciones ?? "",
        activo: f.activo,
      })}
      columnas={[
        { accessorKey: "nombre", header: "Nombre" },
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
          <CampoTexto form={form} name="localidad" label="Localidad" />
          <CampoTexto form={form} name="provincia" label="Provincia" />
          <CampoBooleano form={form} name="tiene_cuenta_corriente" label="Tiene cuenta corriente" />
          <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />
          <CampoBooleano form={form} name="activo" label="Activo" />
        </>
      )}
      crear={crearEstacionServicio}
      actualizar={actualizarEstacionServicio}
      eliminar={eliminarEstacionServicio}
    />
  );
}
