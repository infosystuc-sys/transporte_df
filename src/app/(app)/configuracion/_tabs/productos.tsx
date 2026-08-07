"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoBooleano, CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { BadgeActivo } from "@/components/catalogos/badge-activo";
import { productoSchema, type ProductoInput } from "@/lib/schemas/catalogos";
import { actualizarProducto, crearProducto, eliminarProducto } from "../actions";

type Fila = {
  id: number;
  nombre: string;
  tipo: "grano" | "fertilizante" | "otro" | null;
  precio_referencia: string | null;
  activo: boolean;
};

const valoresPorDefecto: ProductoInput = {
  nombre: "",
  tipo: undefined,
  precio_referencia: undefined,
  activo: true,
};

const opcionesTipo = [
  { value: "grano", label: "Grano" },
  { value: "fertilizante", label: "Fertilizante" },
  { value: "otro", label: "Otro" },
];

export function TabProductos({ filas }: { filas: Fila[] }) {
  return (
    <AbmCatalogoSimple<Fila, ProductoInput>
      titulo="producto"
      filas={filas}
      etiquetaFila={(f) => f.nombre}
      resolver={zodResolver(productoSchema)}
      valoresPorDefecto={valoresPorDefecto}
      aValoresFormulario={(f) => ({
        nombre: f.nombre,
        tipo: f.tipo ?? undefined,
        precio_referencia: f.precio_referencia ?? undefined,
        activo: f.activo,
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
        { accessorKey: "precio_referencia", header: "Precio de referencia" },
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
          <CampoTexto form={form} name="precio_referencia" label="Precio de referencia ($)" />
          <CampoBooleano form={form} name="activo" label="Activo" />
        </>
      )}
      crear={crearProducto}
      actualizar={actualizarProducto}
      eliminar={eliminarProducto}
    />
  );
}
