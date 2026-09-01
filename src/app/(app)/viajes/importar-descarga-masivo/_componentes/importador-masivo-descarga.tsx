"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import type { ViajeEncontradoPorCtg } from "../../_lib/buscar-ctg";
import { previsualizarImportacionDescarga } from "../../importar-descarga/actions";

export type EstadoItemDescarga = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLoteDescarga = {
  id: string;
  archivo: File;
  estado: EstadoItemDescarga;
  ctgBuscado: string | null;
  viajesEncontrados: ViajeEncontradoPorCtg[] | null;
  datosExtraidos: ComprobanteDescargaExtraido | null;
  /** Único candidato resuelto -- null si no se encontró ninguno o si hay más de uno sin elegir. */
  viajeElegido: ViajeEncontradoPorCtg | null;
  error: string | null;
};

const ETIQUETAS_ESTADO_ITEM: Record<EstadoItemDescarga, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando...",
  listo: "Listo",
  revisar: "Revisar",
  error: "Error",
  confirmado: "Confirmado",
};

export function ImportadorMasivoDescarga() {
  const [items, setItems] = useState<ItemLoteDescarga[]>([]);
  const [procesando, setProcesando] = useState(false);

  function actualizarItem(id: string, cambios: Partial<ItemLoteDescarga>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  async function procesarUno(item: ItemLoteDescarga) {
    actualizarItem(item.id, { estado: "procesando" });
    const formData = new FormData();
    formData.set("archivo", item.archivo);
    const r = await previsualizarImportacionDescarga(formData);
    if (!r.ok) {
      actualizarItem(item.id, { estado: "error", error: r.error });
      return;
    }
    const viajeUnico = r.viajes.length === 1 ? r.viajes[0] : null;
    const yaTieneDescarga = !!viajeUnico?.fecha_descarga;
    // Igual que en la tanda de CPE: nunca se ofrece confirmar de un toque
    // si hay algo para revisar a mano -- acá eso incluye no encontrar el
    // viaje, encontrar más de uno, o que ya tenga descarga cargada (nunca
    // sobrescribir a ciegas).
    const necesitaRevision =
      !viajeUnico || yaTieneDescarga || r.datos.campos_dudosos.length > 0;
    actualizarItem(item.id, {
      estado: necesitaRevision ? "revisar" : "listo",
      ctgBuscado: r.datos.ctg,
      viajesEncontrados: r.viajes,
      datosExtraidos: r.datos,
      viajeElegido: viajeUnico,
    });
  }

  async function onSeleccionarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    const nuevosItems: ItemLoteDescarga[] = archivos.map((archivo) => ({
      id: crypto.randomUUID(),
      archivo,
      estado: "pendiente",
      ctgBuscado: null,
      viajesEncontrados: null,
      datosExtraidos: null,
      viajeElegido: null,
      error: null,
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
          <Label htmlFor="archivos-descarga">Tickets de balanza o notas de recepción</Label>
          <Input
            id="archivos-descarga"
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
