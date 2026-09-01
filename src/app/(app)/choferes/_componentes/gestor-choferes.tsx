"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeActivo } from "@/components/catalogos/badge-activo";
import { choferSchema, type ChoferInput } from "@/lib/schemas/flota";
import { formatoFechaInput } from "@/lib/schemas/campos-fecha";
import { actualizarChofer, crearChofer, eliminarChofer } from "../actions";

type ModalidadPago =
  | "porcentaje_flete"
  | "monto_fijo_viaje"
  | "por_tonelada"
  | "sueldo"
  | "sin_definir";

type Fila = {
  id: number;
  nombre_completo: string;
  cuil: string | null;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  licencia_nro: string | null;
  licencia_vto: Date | null;
  linti_vto: Date | null;
  modalidad_pago: ModalidadPago | null;
  valor_pago: string | null;
  camion_habitual_id: number | null;
  observaciones: string | null;
  activo: boolean;
};

function valoresPorDefectoDe(porcentajeChoferDefault: string): ChoferInput {
  return {
    nombre_completo: "",
    cuil: "",
    dni: "",
    telefono: "",
    email: "",
    direccion: "",
    localidad: "",
    licencia_nro: "",
    licencia_vto: undefined,
    linti_vto: undefined,
    modalidad_pago: "porcentaje_flete",
    // Antes hardcodeado en "15" -- el campo "% del chofer por defecto" de
    // Configuración no tenía ningún efecto real, así que cambiarlo ahí no
    // cambiaba nada acá. Ahora sí lo toma como punto de partida para un
    // chofer nuevo (sigue siendo editable por chofer).
    valor_pago: porcentajeChoferDefault,
    camion_habitual_id: undefined,
    observaciones: "",
    activo: true,
  };
}

const opcionesModalidadPago: { value: ModalidadPago; label: string }[] = [
  { value: "porcentaje_flete", label: "Porcentaje del flete" },
  { value: "monto_fijo_viaje", label: "Monto fijo por viaje" },
  { value: "por_tonelada", label: "Por tonelada" },
  { value: "sueldo", label: "Sueldo" },
  { value: "sin_definir", label: "Sin definir" },
];

export function GestorChoferes({
  filas,
  camiones,
  porcentajeChoferDefault,
}: {
  filas: Fila[];
  camiones: { id: number; dominio_tractor: string }[];
  porcentajeChoferDefault: string;
}) {
  const opcionesCamion = camiones.map((c) => ({ value: String(c.id), label: c.dominio_tractor }));

  return (
    <AbmCatalogoSimple<Fila, ChoferInput>
      titulo="chofer"
      filas={filas}
      etiquetaFila={(f) => f.nombre_completo}
      resolver={zodResolver(choferSchema)}
      valoresPorDefecto={valoresPorDefectoDe(porcentajeChoferDefault)}
      aValoresFormulario={(f) => ({
        nombre_completo: f.nombre_completo,
        cuil: f.cuil ?? "",
        dni: f.dni ?? "",
        telefono: f.telefono ?? "",
        email: f.email ?? "",
        direccion: f.direccion ?? "",
        localidad: f.localidad ?? "",
        licencia_nro: f.licencia_nro ?? "",
        licencia_vto: formatoFechaInput(f.licencia_vto),
        linti_vto: formatoFechaInput(f.linti_vto),
        modalidad_pago: f.modalidad_pago ?? "porcentaje_flete",
        valor_pago: f.valor_pago ?? porcentajeChoferDefault,
        camion_habitual_id: f.camion_habitual_id ?? undefined,
        observaciones: f.observaciones ?? "",
        activo: f.activo,
      })}
      columnas={[
        {
          accessorKey: "nombre_completo",
          header: "Nombre completo",
          cell: ({ row }) => (
            <Link
              href={`/choferes/${row.original.id}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.nombre_completo}
            </Link>
          ),
        },
        { accessorKey: "cuil", header: "CUIL" },
        { accessorKey: "telefono", header: "Teléfono" },
        {
          accessorKey: "activo",
          header: "Estado",
          cell: ({ getValue }) => <BadgeActivo activo={getValue() as boolean} />,
        },
      ]}
      campos={(form) => (
        <>
          <CampoTexto form={form} name="nombre_completo" label="Nombre completo" />
          <CampoTexto form={form} name="cuil" label="CUIL" />
          <CampoTexto form={form} name="dni" label="DNI" />
          <CampoTexto form={form} name="telefono" label="Teléfono" />
          <CampoTexto form={form} name="email" label="Email" tipo="email" />
          <CampoTexto form={form} name="direccion" label="Dirección" />
          <CampoTexto form={form} name="localidad" label="Localidad" />
          <CampoTexto form={form} name="licencia_nro" label="N° de licencia" />
          <CampoTexto form={form} name="licencia_vto" label="Vencimiento de licencia" tipo="date" />
          <CampoTexto form={form} name="linti_vto" label="Vencimiento LINTI" tipo="date" />
          <CampoSelect
            form={form}
            name="modalidad_pago"
            label="Modalidad de pago"
            opciones={opcionesModalidadPago}
          />
          <CampoTexto form={form} name="valor_pago" label="Valor de pago (% o $ según modalidad)" />
          <CampoSelect
            form={form}
            name="camion_habitual_id"
            label="Camión habitual"
            opciones={opcionesCamion}
            placeholder="Ninguno"
          />
          <CampoBooleano form={form} name="activo" label="Activo" />
          <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />
        </>
      )}
      crear={crearChofer}
      actualizar={actualizarChofer}
      eliminar={eliminarChofer}
    />
  );
}
