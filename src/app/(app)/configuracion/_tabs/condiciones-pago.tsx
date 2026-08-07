"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { CampoTexto } from "@/components/catalogos/campos-formulario";
import { condicionPagoSchema, type CondicionPagoInput } from "@/lib/schemas/catalogos";
import {
  actualizarCondicionPago,
  crearCondicionPago,
  eliminarCondicionPago,
} from "../actions";

type Fila = { id: number; nombre: string; dias: number | null; observaciones: string | null };

const valoresPorDefecto: CondicionPagoInput = { nombre: "", dias: undefined, observaciones: "" };

export function TabCondicionesPago({ filas }: { filas: Fila[] }) {
  return (
    <AbmCatalogoSimple<Fila, CondicionPagoInput>
      titulo="condición de pago"
      filas={filas}
      etiquetaFila={(f) => f.nombre}
      resolver={zodResolver(condicionPagoSchema)}
      valoresPorDefecto={valoresPorDefecto}
      aValoresFormulario={(f) => ({
        nombre: f.nombre,
        dias: f.dias ?? undefined,
        observaciones: f.observaciones ?? "",
      })}
      columnas={[{ accessorKey: "nombre", header: "Nombre" }, { accessorKey: "dias", header: "Días" }]}
      campos={(form) => (
        <>
          <CampoTexto form={form} name="nombre" label="Nombre" />
          <CampoTexto form={form} name="dias" label="Días" tipo="number" />
          <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />
        </>
      )}
      crear={crearCondicionPago}
      actualizar={actualizarCondicionPago}
      eliminar={eliminarCondicionPago}
    />
  );
}
