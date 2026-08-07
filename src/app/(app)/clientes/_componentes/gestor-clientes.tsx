"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeActivo } from "@/components/catalogos/badge-activo";
import { clienteSchema, type ClienteInput } from "@/lib/schemas/clientes";
import { actualizarCliente, crearCliente, eliminarCliente } from "../actions";

type Fila = {
  id: number;
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string | null;
  condicion_iva: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
  es_dador_carga: boolean;
  es_pagador_flete: boolean;
  condicion_pago_id: number | null;
  base_calculo_flete: "origen" | "destino" | "heredar" | null;
  tolerancia_merma_pct: string | null;
  observaciones: string | null;
  activo: boolean;
};

const valoresPorDefecto: ClienteInput = {
  razon_social: "",
  nombre_fantasia: "",
  cuit: "",
  condicion_iva: "",
  direccion: "",
  localidad: "",
  provincia: "",
  telefono: "",
  email: "",
  contacto: "",
  es_dador_carga: false,
  es_pagador_flete: false,
  condicion_pago_id: undefined,
  base_calculo_flete: "heredar",
  tolerancia_merma_pct: undefined,
  observaciones: "",
  activo: true,
};

const opcionesBaseCalculo = [
  { value: "heredar", label: "Heredar de la configuración" },
  { value: "origen", label: "Origen" },
  { value: "destino", label: "Destino" },
];

export function GestorClientes({
  filas,
  condicionesPago,
}: {
  filas: Fila[];
  condicionesPago: { id: number; nombre: string }[];
}) {
  const opcionesCondicionPago = condicionesPago.map((c) => ({
    value: String(c.id),
    label: c.nombre,
  }));

  return (
    <AbmCatalogoSimple<Fila, ClienteInput>
      titulo="cliente"
      filas={filas}
      etiquetaFila={(f) => f.razon_social}
      resolver={zodResolver(clienteSchema)}
      valoresPorDefecto={valoresPorDefecto}
      aValoresFormulario={(f) => ({
        razon_social: f.razon_social,
        nombre_fantasia: f.nombre_fantasia ?? "",
        cuit: f.cuit ?? "",
        condicion_iva: f.condicion_iva ?? "",
        direccion: f.direccion ?? "",
        localidad: f.localidad ?? "",
        provincia: f.provincia ?? "",
        telefono: f.telefono ?? "",
        email: f.email ?? "",
        contacto: f.contacto ?? "",
        es_dador_carga: f.es_dador_carga,
        es_pagador_flete: f.es_pagador_flete,
        condicion_pago_id: f.condicion_pago_id ?? undefined,
        base_calculo_flete: f.base_calculo_flete ?? "heredar",
        tolerancia_merma_pct: f.tolerancia_merma_pct ?? undefined,
        observaciones: f.observaciones ?? "",
        activo: f.activo,
      })}
      columnas={[
        { accessorKey: "razon_social", header: "Razón social" },
        { accessorKey: "cuit", header: "CUIT" },
        { accessorKey: "localidad", header: "Localidad" },
        {
          accessorKey: "activo",
          header: "Estado",
          cell: ({ getValue }) => <BadgeActivo activo={getValue() as boolean} />,
        },
      ]}
      campos={(form) => (
        <>
          <CampoTexto form={form} name="razon_social" label="Razón social" />
          <CampoTexto form={form} name="nombre_fantasia" label="Nombre de fantasía" />
          <CampoTexto form={form} name="cuit" label="CUIT" />
          <CampoTexto form={form} name="condicion_iva" label="Condición frente al IVA" />
          <CampoTexto form={form} name="direccion" label="Dirección" />
          <CampoTexto form={form} name="localidad" label="Localidad" />
          <CampoTexto form={form} name="provincia" label="Provincia" />
          <CampoTexto form={form} name="telefono" label="Teléfono" />
          <CampoTexto form={form} name="email" label="Email" tipo="email" />
          <CampoTexto form={form} name="contacto" label="Contacto" />
          <CampoSelect
            form={form}
            name="condicion_pago_id"
            label="Condición de pago"
            opciones={opcionesCondicionPago}
          />
          <CampoSelect
            form={form}
            name="base_calculo_flete"
            label="Base de cálculo del flete"
            opciones={opcionesBaseCalculo}
          />
          <CampoTexto
            form={form}
            name="tolerancia_merma_pct"
            label="Tolerancia de merma (%, opcional)"
          />
          <CampoBooleano form={form} name="es_dador_carga" label="Es dador de carga" />
          <CampoBooleano form={form} name="es_pagador_flete" label="Es pagador de flete" />
          <CampoBooleano form={form} name="activo" label="Activo" />
          <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />
        </>
      )}
      crear={crearCliente}
      actualizar={actualizarCliente}
      eliminar={eliminarCliente}
    />
  );
}
