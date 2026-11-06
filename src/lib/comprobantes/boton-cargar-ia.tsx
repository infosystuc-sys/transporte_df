"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mensajeArchivoMuyPesado, prepararArchivoParaSubir } from "@/lib/archivos/preparar-subida";
import { previsualizarComprobante } from "./actions";
import type { ComprobanteExtraido } from "./claude";

/**
 * Botón compartido por los tres formularios que aceptan comprobantes por
 * IA (gasoil, gastos del viaje, adicionales/estadía). Solo se ocupa de
 * subir el archivo y devolver lo que Claude extrajo — cada formulario
 * decide qué campos precargar y guarda el archivo elegido para adjuntarlo
 * cuando el usuario confirma el alta (nunca se guarda nada acá).
 */
export function BotonCargarIA({
  onExtraido,
}: {
  onExtraido: (archivo: File, datos: ComprobanteExtraido) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function onSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;

    startTransition(async () => {
      // Una captura del iPhone en PNG puede pasar los 4,5 MB que acepta
      // Vercel: se achica antes de subirla (ver preparar-subida.ts).
      const archivo = await prepararArchivoParaSubir(original);
      const pesado = mensajeArchivoMuyPesado(archivo);
      if (pesado) {
        toast.error(pesado);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      const formData = new FormData();
      formData.set("archivo", archivo);
      const resultado = await previsualizarComprobante(formData);
      if ("error" in resultado) {
        toast.error(resultado.error);
      } else {
        onExtraido(archivo, resultado);
        toast.success("Datos precargados desde el comprobante — revisá antes de guardar.");
      }
      // Permite volver a elegir el mismo archivo si hace falta reintentar.
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        className="hidden"
        onChange={onSeleccionar}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? "Leyendo comprobante..." : "Cargar por IA"}
      </Button>
    </>
  );
}
