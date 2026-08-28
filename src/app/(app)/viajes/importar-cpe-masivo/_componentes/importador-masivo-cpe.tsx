"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";
import type { ResultadoImportacionCpe } from "@/lib/cpe/importar";
import { importarCpe } from "../../importar-cpe/actions";

export type EstadoItem = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLote = {
  id: string;
  archivo: File;
  estado: EstadoItem;
  resultado: ResultadoImportacionCpe | null;
  error: string | null;
  viajeId: number | null;
};

const ETIQUETAS_ESTADO: Record<EstadoItem, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando...",
  listo: "Listo",
  revisar: "Revisar",
  error: "Error",
  confirmado: "Confirmado",
};

export function ImportadorMasivoCpe(_catalogos: CatalogosImportacionCpe) {
  const [items, setItems] = useState<ItemLote[]>([]);
  const [procesando, setProcesando] = useState(false);

  function actualizarItem(id: string, cambios: Partial<ItemLote>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  async function procesarUno(item: ItemLote) {
    actualizarItem(item.id, { estado: "procesando" });
    try {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      const r = await importarCpe(formData);
      const necesitaRevision = r.motivoManual != null || r.extraido.campos_dudosos.length > 0;
      actualizarItem(item.id, { estado: necesitaRevision ? "revisar" : "listo", resultado: r });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      actualizarItem(item.id, { estado: "error", error: mensaje });
    }
  }

  async function onSeleccionarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    const nuevosItems: ItemLote[] = archivos.map((archivo) => ({
      id: crypto.randomUUID(),
      archivo,
      estado: "pendiente",
      resultado: null,
      error: null,
      viajeId: null,
    }));
    setItems(nuevosItems);
    e.target.value = "";

    setProcesando(true);
    for (const item of nuevosItems) {
      await procesarUno(item);
    }
    setProcesando(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivos-cpe">Archivos o fotos de las CPE</Label>
          <Input
            id="archivos-cpe"
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
          <h3 className="text-sm font-bold">Procesando {items.length} archivo(s)</h3>
          <ul className="flex flex-col gap-1">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{it.archivo.name}</span>
                <span className="text-muted-foreground">
                  {ETIQUETAS_ESTADO[it.estado]}
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
