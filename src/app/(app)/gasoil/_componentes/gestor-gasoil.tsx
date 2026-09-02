"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AbmCatalogoSimple } from "@/components/catalogos/abm-catalogo-simple";
import { Badge } from "@/components/ui/badge";
import { BotonCargarIA } from "@/lib/comprobantes/boton-cargar-ia";
import { cargaGasoilSchema, type CargaGasoilInput } from "@/lib/schemas/gasoil";
import { formatoFechaInput } from "@/lib/schemas/campos-fecha";
import {
  actualizarCargaGasoil,
  crearCargaGasoil,
  crearCargaGasoilConAdjunto,
  eliminarCargaGasoil,
} from "../actions";
import { CamposRevisionGasoil } from "./campos-revision-gasoil";

type Opcion = { id: number; nombre: string };

type Fila = {
  id: number;
  fecha: Date;
  camion_id: number;
  chofer_id: number | null;
  viaje_id: number | null;
  estacion_id: number | null;
  litros: string;
  precio_litro: string | null;
  importe: string | null;
  odometro: number | null;
  modalidad: "cuenta_corriente" | "pagado_por_chofer" | "surtidor_propio";
  rendido: boolean | null;
  comprobante_nro: string | null;
  observaciones: string | null;
};

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

const valoresPorDefecto: CargaGasoilInput = {
  fecha: formatoFechaInput(new Date()) as unknown as Date,
  camion_id: undefined as unknown as number,
  chofer_id: undefined,
  viaje_id: undefined,
  estacion_id: undefined,
  litros: "",
  precio_litro: "",
  importe: "",
  odometro: undefined,
  modalidad: "cuenta_corriente",
  rendido: false,
  comprobante_nro: "",
  observaciones: "",
};

export function GestorGasoil({
  filas,
  camiones,
  choferes,
  estaciones,
  viajes,
}: {
  filas: Fila[];
  camiones: Opcion[];
  choferes: Opcion[];
  estaciones: Opcion[];
  viajes: Opcion[];
}) {
  const nombreCamion = (id: number) => camiones.find((c) => c.id === id)?.nombre ?? "—";

  // El archivo de "Cargar por IA" se guarda acá (no en el form) hasta el
  // submit final: camion_id y odómetro siempre se completan a mano, así
  // que el alta real recién pasa cuando el usuario confirma el formulario
  // ya precargado, no en el momento en que sube el comprobante.
  const [archivoIA, setArchivoIA] = useState<File | null>(null);

  async function crearConPosibleAdjunto(valores: CargaGasoilInput) {
    if (!archivoIA) return crearCargaGasoil(valores);
    const formData = new FormData();
    formData.set("archivo", archivoIA);
    formData.set("datos", JSON.stringify(valores));
    const resultado = await crearCargaGasoilConAdjunto(formData);
    setArchivoIA(null);
    return resultado;
  }

  return (
    <AbmCatalogoSimple<Fila, CargaGasoilInput>
      titulo="carga de gasoil"
      filas={filas}
      etiquetaFila={(f) => `${nombreCamion(f.camion_id)} — ${formatoFecha.format(f.fecha)}`}
      resolver={zodResolver(cargaGasoilSchema)}
      valoresPorDefecto={valoresPorDefecto}
      aValoresFormulario={(f) => ({
        fecha: formatoFechaInput(f.fecha) as unknown as Date,
        camion_id: f.camion_id,
        chofer_id: f.chofer_id ?? undefined,
        viaje_id: f.viaje_id ?? undefined,
        estacion_id: f.estacion_id ?? undefined,
        litros: f.litros,
        precio_litro: f.precio_litro ?? "",
        importe: f.importe ?? "",
        odometro: f.odometro ?? undefined,
        modalidad: f.modalidad,
        rendido: f.rendido ?? false,
        comprobante_nro: f.comprobante_nro ?? "",
        observaciones: f.observaciones ?? "",
      })}
      columnas={[
        { accessorKey: "fecha", header: "Fecha", cell: ({ getValue }) => formatoFecha.format(getValue() as Date) },
        {
          accessorKey: "camion_id",
          header: "Camión",
          cell: ({ getValue }) => nombreCamion(getValue() as number),
        },
        { accessorKey: "litros", header: "Litros" },
        {
          accessorKey: "importe",
          header: "Importe",
          cell: ({ getValue }) => {
            const v = getValue() as string | null;
            return v != null ? formatoARS.format(Number(v)) : "—";
          },
        },
        {
          accessorKey: "modalidad",
          header: "Modalidad",
          cell: ({ getValue }) => (
            <Badge variant={getValue() === "pagado_por_chofer" ? "secondary" : "outline"}>
              {getValue() === "pagado_por_chofer" ? "Chofer" : "Cta. cte."}
            </Badge>
          ),
        },
        {
          accessorKey: "odometro",
          header: "Odómetro",
          cell: ({ getValue }) => (getValue() as number | null) ?? "—",
        },
      ]}
      campos={(form) => (
        <>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <BotonCargarIA
              onExtraido={(archivo, datos) => {
                setArchivoIA(archivo);
                form.reset({
                  ...form.getValues(),
                  fecha: (datos.fecha
                    ? formatoFechaInput(datos.fecha)
                    : form.getValues("fecha")) as unknown as Date,
                  litros: datos.litros != null ? String(datos.litros) : form.getValues("litros"),
                  importe:
                    datos.importe_total != null
                      ? String(datos.importe_total)
                      : form.getValues("importe"),
                  comprobante_nro: datos.comprobante_nro ?? form.getValues("comprobante_nro"),
                  // Muchos tickets de surtidor traen patente y chofer al pie
                  // (ver claude.ts) -- se precargan solo si matchearon un
                  // único registro existente, siempre editables. El
                  // odómetro no sale de acá: el "Km" que a veces trae el
                  // ticket no es el odómetro real del camión.
                  camion_id: datos.camion_id ?? form.getValues("camion_id"),
                  chofer_id: datos.chofer_id ?? form.getValues("chofer_id"),
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Precarga litros, importe, fecha, N° de comprobante y (si los reconoce) camión y
              chofer. Revisá esos dos igual antes de guardar — el odómetro siempre se completa a
              mano.
            </p>
          </div>
          <CamposRevisionGasoil
            form={form}
            camiones={camiones}
            choferes={choferes}
            estaciones={estaciones}
            viajes={viajes}
          />
        </>
      )}
      crear={crearConPosibleAdjunto}
      actualizar={actualizarCargaGasoil}
      eliminar={eliminarCargaGasoil}
      onAbrir={() => setArchivoIA(null)}
    />
  );
}
