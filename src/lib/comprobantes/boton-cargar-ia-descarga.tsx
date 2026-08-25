"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { previsualizarComprobanteDescarga } from "./actions";
import type { ComprobanteDescargaExtraido } from "./claude-descarga";

/**
 * Igual que BotonCargarIA pero para el ticket de balanza de descarga —
 * campos y prompt de extracción distintos (pesos y fechas, no plata), así
 * que no comparte el mismo componente.
 */
export function BotonCargarIADescarga({
  onExtraido,
}: {
  onExtraido: (archivo: File, datos: ComprobanteDescargaExtraido) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function onSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("archivo", archivo);
        const datos = await previsualizarComprobanteDescarga(formData);
        onExtraido(archivo, datos);
        toast.success("Datos precargados desde el ticket — revisá antes de guardar.");
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err);
        toast.error(mensaje);
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
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
        {isPending ? "Leyendo ticket..." : "Cargar ticket de balanza por IA"}
      </Button>
    </>
  );
}
