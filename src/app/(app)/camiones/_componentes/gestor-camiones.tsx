"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeActivo } from "@/components/catalogos/badge-activo";
import { camionSchema, type CamionInput } from "@/lib/schemas/flota";
import { formatoFechaInput } from "@/lib/schemas/campos-fecha";
import { actualizarCamion, crearCamion, eliminarCamion } from "../actions";

type Fila = {
  id: number;
  dominio_tractor: string;
  dominio_acoplado: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  n_chasis: string | null;
  n_motor: string | null;
  titular: string | null;
  tara_kg: number | null;
  capacidad_kg: number | null;
  vto_vtv: Date | null;
  vto_seguro: Date | null;
  aseguradora: string | null;
  poliza: string | null;
  vto_ruta: Date | null;
  vto_cnrt: Date | null;
  vto_senasa: Date | null;
  odometro_actual: number | null;
  observaciones: string | null;
  activo: boolean;
};

const valoresPorDefecto: CamionInput = {
  dominio_tractor: "",
  dominio_acoplado: "",
  marca: "",
  modelo: "",
  anio: undefined,
  n_chasis: "",
  n_motor: "",
  titular: "",
  tara_kg: undefined,
  capacidad_kg: undefined,
  vto_vtv: undefined,
  vto_seguro: undefined,
  aseguradora: "",
  poliza: "",
  vto_ruta: undefined,
  vto_cnrt: undefined,
  vto_senasa: undefined,
  odometro_actual: undefined,
  observaciones: "",
  activo: true,
};

export function GestorCamiones({ filas }: { filas: Fila[] }) {
  return (
    <AbmCatalogoSimple<Fila, CamionInput>
      titulo="camión"
      filas={filas}
      etiquetaFila={(f) => f.dominio_tractor}
      resolver={zodResolver(camionSchema)}
      valoresPorDefecto={valoresPorDefecto}
      aValoresFormulario={(f) => ({
        dominio_tractor: f.dominio_tractor,
        dominio_acoplado: f.dominio_acoplado ?? "",
        marca: f.marca ?? "",
        modelo: f.modelo ?? "",
        anio: f.anio ?? undefined,
        n_chasis: f.n_chasis ?? "",
        n_motor: f.n_motor ?? "",
        titular: f.titular ?? "",
        tara_kg: f.tara_kg ?? undefined,
        capacidad_kg: f.capacidad_kg ?? undefined,
        vto_vtv: formatoFechaInput(f.vto_vtv),
        vto_seguro: formatoFechaInput(f.vto_seguro),
        aseguradora: f.aseguradora ?? "",
        poliza: f.poliza ?? "",
        vto_ruta: formatoFechaInput(f.vto_ruta),
        vto_cnrt: formatoFechaInput(f.vto_cnrt),
        vto_senasa: formatoFechaInput(f.vto_senasa),
        odometro_actual: f.odometro_actual ?? undefined,
        observaciones: f.observaciones ?? "",
        activo: f.activo,
      })}
      columnas={[
        { accessorKey: "dominio_tractor", header: "Dominio tractor" },
        { accessorKey: "dominio_acoplado", header: "Dominio acoplado" },
        { accessorKey: "marca", header: "Marca" },
        {
          accessorKey: "activo",
          header: "Estado",
          cell: ({ getValue }) => <BadgeActivo activo={getValue() as boolean} />,
        },
      ]}
      campos={(form) => (
        <>
          <CampoTexto form={form} name="dominio_tractor" label="Dominio tractor" />
          <CampoTexto form={form} name="dominio_acoplado" label="Dominio acoplado" />
          <CampoTexto form={form} name="marca" label="Marca" />
          <CampoTexto form={form} name="modelo" label="Modelo" />
          <CampoTexto form={form} name="anio" label="Año" tipo="number" />
          <CampoTexto form={form} name="titular" label="Titular" />
          <CampoTexto form={form} name="n_chasis" label="N° de chasis" />
          <CampoTexto form={form} name="n_motor" label="N° de motor" />
          <CampoTexto form={form} name="tara_kg" label="Tara (kg)" tipo="number" />
          <CampoTexto form={form} name="capacidad_kg" label="Capacidad (kg)" tipo="number" />
          <CampoTexto form={form} name="odometro_actual" label="Odómetro actual (km)" tipo="number" />
          <CampoTexto form={form} name="vto_vtv" label="Vencimiento VTV" tipo="date" />
          <CampoTexto form={form} name="vto_seguro" label="Vencimiento seguro" tipo="date" />
          <CampoTexto form={form} name="aseguradora" label="Aseguradora" />
          <CampoTexto form={form} name="poliza" label="N° de póliza" />
          <CampoTexto form={form} name="vto_ruta" label="Vencimiento ruta" tipo="date" />
          <CampoTexto form={form} name="vto_cnrt" label="Vencimiento CNRT" tipo="date" />
          <CampoTexto form={form} name="vto_senasa" label="Vencimiento SENASA" tipo="date" />
          <CampoBooleano form={form} name="activo" label="Activo" />
          <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />
        </>
      )}
      crear={crearCamion}
      actualizar={actualizarCamion}
      eliminar={eliminarCamion}
    />
  );
}
