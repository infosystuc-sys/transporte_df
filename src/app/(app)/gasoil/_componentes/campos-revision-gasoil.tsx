"use client";

import { CampoBooleano, CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { formatoFechaInput } from "@/lib/schemas/campos-fecha";
import type { UseFormReturn } from "react-hook-form";
import type { CargaGasoilInput } from "@/lib/schemas/gasoil";
import type { ComprobanteExtraido } from "@/lib/comprobantes/claude";
import type { OpcionGasoil } from "@/lib/gasoil/datos-catalogos";

export const opcionesModalidad = [
  { value: "cuenta_corriente", label: "Cuenta corriente (empresa)" },
  { value: "pagado_por_chofer", label: "Pagado por el chofer" },
  { value: "surtidor_propio", label: "Surtidor propio" },
];

/**
 * Solo la usa la pantalla en tanda (Task 4): arranca un formulario nuevo
 * desde cero a partir de lo que leyó la IA. La pantalla de un solo
 * archivo NO usa esto -- su onExtraido hace un merge parcial sobre los
 * valores que ya había en el formulario, comportamiento que no cambia.
 */
export function construirValoresGasoil(datos: ComprobanteExtraido): CargaGasoilInput {
  return {
    fecha: (datos.fecha ? formatoFechaInput(datos.fecha) : undefined) as unknown as Date,
    camion_id: (datos.camion_id ?? undefined) as unknown as number,
    chofer_id: datos.chofer_id ?? undefined,
    viaje_id: undefined,
    estacion_id: undefined,
    litros: datos.litros != null ? String(datos.litros) : "",
    precio_litro: "",
    importe: datos.importe_total != null ? String(datos.importe_total) : "",
    odometro: undefined,
    modalidad: "cuenta_corriente",
    rendido: false,
    comprobante_nro: datos.comprobante_nro ?? "",
    observaciones: "",
  };
}

export function CamposRevisionGasoil({
  form,
  camiones,
  choferes,
  estaciones,
  viajes,
}: {
  form: UseFormReturn<CargaGasoilInput>;
  camiones: OpcionGasoil[];
  choferes: OpcionGasoil[];
  estaciones: OpcionGasoil[];
  viajes: OpcionGasoil[];
}) {
  const opciones = (lista: OpcionGasoil[]) => lista.map((o) => ({ value: String(o.id), label: o.nombre }));

  return (
    <>
      <CampoTexto form={form} name="fecha" label="Fecha" tipo="date" />
      <CampoSelect form={form} name="camion_id" label="Camión" opciones={opciones(camiones)} />
      <CampoSelect form={form} name="chofer_id" label="Chofer" opciones={opciones(choferes)} />
      <CampoSelect form={form} name="estacion_id" label="Estación" opciones={opciones(estaciones)} />
      <CampoSelect form={form} name="viaje_id" label="Viaje (opcional)" opciones={opciones(viajes)} />
      <CampoTexto form={form} name="litros" label="Litros" />
      <CampoTexto form={form} name="precio_litro" label="Precio por litro ($)" />
      <CampoTexto form={form} name="importe" label="Importe total ($)" />
      <CampoTexto form={form} name="odometro" label="Odómetro (km)" tipo="number" />
      <CampoSelect form={form} name="modalidad" label="Modalidad de pago" opciones={opcionesModalidad} />
      <CampoBooleano form={form} name="rendido" label="Rendido (si lo pagó el chofer)" />
      <CampoTexto form={form} name="comprobante_nro" label="N° de comprobante" />
      <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />
    </>
  );
}
