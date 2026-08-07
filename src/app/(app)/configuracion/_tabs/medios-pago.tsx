"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeActivo } from "@/components/catalogos/badge-activo";
import { medioPagoSchema, type MedioPagoInput } from "@/lib/schemas/catalogos";
import { actualizarMedioPago, crearMedioPago, eliminarMedioPago } from "../actions";

type Fila = { id: number; nombre: string; requiere_datos_cheque: boolean; activo: boolean };

const valoresPorDefecto: MedioPagoInput = {
  nombre: "",
  requiere_datos_cheque: false,
  activo: true,
};

export function TabMediosPago({ filas }: { filas: Fila[] }) {
  return (
    <AbmCatalogoSimple<Fila, MedioPagoInput>
      titulo="medio de pago"
      filas={filas}
      etiquetaFila={(f) => f.nombre}
      resolver={zodResolver(medioPagoSchema)}
      valoresPorDefecto={valoresPorDefecto}
      aValoresFormulario={(f) => ({
        nombre: f.nombre,
        requiere_datos_cheque: f.requiere_datos_cheque,
        activo: f.activo,
      })}
      columnas={[
        { accessorKey: "nombre", header: "Nombre" },
        {
          accessorKey: "requiere_datos_cheque",
          header: "Requiere datos de cheque",
          cell: ({ getValue }) => (getValue() ? "Sí" : "No"),
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
          <CampoBooleano form={form} name="requiere_datos_cheque" label="Requiere datos de cheque" />
          <CampoBooleano form={form} name="activo" label="Activo" />
        </>
      )}
      crear={crearMedioPago}
      actualizar={actualizarMedioPago}
      eliminar={eliminarMedioPago}
    />
  );
}
