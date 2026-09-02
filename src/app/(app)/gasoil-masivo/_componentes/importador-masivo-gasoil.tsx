"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previsualizarComprobante } from "@/lib/comprobantes/actions";
import type { ComprobanteExtraido } from "@/lib/comprobantes/claude";
import type { OpcionGasoil } from "@/lib/gasoil/datos-catalogos";

export type EstadoItemGasoil = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLoteGasoil = {
  id: string;
  archivo: File;
  estado: EstadoItemGasoil;
  datosExtraidos: ComprobanteExtraido | null;
  error: string | null;
};

const ETIQUETAS_ESTADO_ITEM: Record<EstadoItemGasoil, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando...",
  listo: "Listo",
  revisar: "Revisar",
  error: "Error",
  confirmado: "Confirmado",
};

const MENSAJE_ERROR_GENERICO = "No se pudo procesar el comprobante.";

export function ImportadorMasivoGasoil({
  camiones,
  choferes,
  estaciones,
  viajes,
}: {
  camiones: OpcionGasoil[];
  choferes: OpcionGasoil[];
  estaciones: OpcionGasoil[];
  viajes: OpcionGasoil[];
}) {
  void choferes;
  void estaciones;
  void viajes;
  const [items, setItems] = useState<ItemLoteGasoil[]>([]);
  const [procesando, setProcesando] = useState(false);

  function actualizarItem(id: string, cambios: Partial<ItemLoteGasoil>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  async function procesarUno(item: ItemLoteGasoil) {
    actualizarItem(item.id, { estado: "procesando", error: null });
    try {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      const resultado = await previsualizarComprobante(formData);
      if ("error" in resultado) {
        actualizarItem(item.id, { estado: "error", error: resultado.error });
        return;
      }
      // Regla vigente en la pantalla de un solo archivo: nunca se crea un
      // camión nuevo desde acá -- si no matcheó, hay que elegirlo a mano.
      const necesitaRevision = resultado.camion_id == null;
      actualizarItem(item.id, {
        estado: necesitaRevision ? "revisar" : "listo",
        datosExtraidos: resultado,
      });
    } catch (err) {
      console.error("procesarUno (gasoil):", err);
      const mensaje = err instanceof Error ? err.message : MENSAJE_ERROR_GENERICO;
      actualizarItem(item.id, { estado: "error", error: mensaje });
    }
  }

  async function onSeleccionarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    const nuevosItems: ItemLoteGasoil[] = archivos.map((archivo) => ({
      id: crypto.randomUUID(),
      archivo,
      estado: "pendiente",
      datosExtraidos: null,
      error: null,
    }));
    setItems(nuevosItems);
    e.target.value = "";

    setProcesando(true);
    try {
      for (const item of nuevosItems) {
        await procesarUno(item);
      }
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivos-gasoil">Comprobantes de carga de combustible</Label>
          <Input
            id="archivos-gasoil"
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            onChange={onSeleccionarArchivos}
            disabled={procesando}
          />
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border p-4">
          <h3 className="text-sm font-bold">{items.length} archivo(s)</h3>
          <ul className="flex flex-col gap-1">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{it.archivo.name}</span>
                <span className="text-muted-foreground">
                  {ETIQUETAS_ESTADO_ITEM[it.estado]}
                  {it.estado === "error" && it.error ? ` — ${it.error}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
