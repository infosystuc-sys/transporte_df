// src/app/(app)/viajes/importar-descarga-masivo/_componentes/importador-masivo-descarga.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { viajeDescargaSchema, type ViajeDescargaInput } from "@/lib/schemas/viajes";
import type { ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import type { ViajeEncontradoPorCtg } from "../../_lib/buscar-ctg";
import { actualizarDescargaConAdjunto } from "../../actions";
import { previsualizarImportacionDescarga } from "../../importar-descarga/actions";
import {
  CamposRevisionDescarga,
  construirValoresDescarga,
  ETIQUETAS_ESTADO,
  PickerViajesEncontrados,
} from "../../importar-descarga/_componentes/campos-revision-descarga";

export type EstadoItemDescarga = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLoteDescarga = {
  id: string;
  archivo: File;
  estado: EstadoItemDescarga;
  ctgBuscado: string | null;
  viajesEncontrados: ViajeEncontradoPorCtg[] | null;
  datosExtraidos: ComprobanteDescargaExtraido | null;
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
  const [idAbierto, setIdAbierto] = useState<string | null>(null);
  const [confirmaSobrescribir, setConfirmaSobrescribir] = useState(false);
  const [isPendingConfirmar, startTransitionConfirmar] = useTransition();

  const itemAbierto = items.find((it) => it.id === idAbierto) ?? null;

  const form = useForm<ViajeDescargaInput>({ resolver: zodResolver(viajeDescargaSchema) });

  // Mismo criterio que el CTG repetido en la tanda de CPE: dos archivos
  // de esta tanda pueden resolver al mismo viaje (ticket subido dos
  // veces, o dos fotos del mismo ticket) -- se avisa, no se bloquea.
  const viajeIdsRepetidosEnLote = useMemo(() => {
    const conteo = new Map<number, number>();
    for (const it of items) {
      if (it.viajeElegido) conteo.set(it.viajeElegido.id, (conteo.get(it.viajeElegido.id) ?? 0) + 1);
    }
    return new Set([...conteo.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [items]);

  function actualizarItem(id: string, cambios: Partial<ItemLoteDescarga>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  async function procesarUno(item: ItemLoteDescarga) {
    actualizarItem(item.id, { estado: "procesando", error: null });
    try {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      const r = await previsualizarImportacionDescarga(formData);
      if (!r.ok) {
        actualizarItem(item.id, { estado: "error", error: r.error });
        return;
      }
      const viajeUnico = r.viajes.length === 1 ? r.viajes[0] : null;
      const yaTieneDescarga = !!viajeUnico?.fecha_descarga;
      const necesitaRevision = !viajeUnico || yaTieneDescarga || r.datos.campos_dudosos.length > 0;
      actualizarItem(item.id, {
        estado: necesitaRevision ? "revisar" : "listo",
        ctgBuscado: r.datos.ctg,
        viajesEncontrados: r.viajes,
        datosExtraidos: r.datos,
        viajeElegido: viajeUnico,
      });
    } catch (err) {
      // Sin esto, una falla de red o de DB (no el {ok:false} que ya
      // maneja la acción) deja la fila trabada en "procesando" para
      // siempre y corta el resto de la tanda -- igual que el catch de
      // confirmarValores, un archivo problemático no puede tirar abajo
      // los demás.
      console.error("previsualizarImportacionDescarga falló:", err);
      const mensaje = err instanceof Error ? err.message : String(err);
      actualizarItem(item.id, { estado: "error", error: mensaje });
    }
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
    setIdAbierto(null);
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

  function abrirDetalle(item: ItemLoteDescarga) {
    setIdAbierto(item.id);
    setConfirmaSobrescribir(false);
    if (item.viajeElegido && item.datosExtraidos) {
      form.reset(construirValoresDescarga(item.datosExtraidos));
    }
  }

  function cerrarDetalle() {
    setIdAbierto(null);
  }

  function elegirViajeEnDetalle(itemId: string, viaje: ViajeEncontradoPorCtg) {
    const item = items.find((it) => it.id === itemId);
    if (!item?.datosExtraidos) return;
    actualizarItem(itemId, { viajeElegido: viaje });
    setConfirmaSobrescribir(false);
    form.reset(construirValoresDescarga(item.datosExtraidos));
  }

  async function confirmarValores(itemId: string, valores: ViajeDescargaInput) {
    const item = items.find((it) => it.id === itemId);
    if (!item?.viajeElegido) return;
    if (item.viajeElegido.fecha_descarga && !confirmaSobrescribir) {
      toast.error("Confirmá el checkbox de sobrescritura antes de guardar.");
      return;
    }
    startTransitionConfirmar(async () => {
      try {
        const formData = new FormData();
        formData.set("archivo", item.archivo);
        formData.set("datos", JSON.stringify(valores));
        const r = await actualizarDescargaConAdjunto(item.viajeElegido!.id, formData);
        if (r?.error) {
          toast.error(r.error);
          return;
        }
        actualizarItem(itemId, { estado: "confirmado" });
        toast.success(`Descarga cargada en el viaje #${item.viajeElegido!.numero}.`);
        if (idAbierto === itemId) setIdAbierto(null);
      } catch (err) {
        console.error("actualizarDescargaConAdjunto falló:", err);
        const mensaje = err instanceof Error ? err.message : String(err);
        toast.error(`No se pudo cargar la descarga: ${mensaje}`);
      }
    });
  }

  function confirmarRapido(item: ItemLoteDescarga) {
    if (!item.viajeElegido || !item.datosExtraidos) return;
    confirmarValores(item.id, construirValoresDescarga(item.datosExtraidos));
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
          <ul className="flex flex-col gap-2">
            {items.map((it) => {
              const repetido = !!it.viajeElegido && viajeIdsRepetidosEnLote.has(it.viajeElegido.id);
              return (
                <li key={it.id} className="flex flex-col gap-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{it.archivo.name}</span>
                      {it.viajeElegido && (
                        <span className="text-xs text-muted-foreground">
                          Viaje #{it.viajeElegido.numero} · {it.viajeElegido.cliente_nombre ?? "—"} ·
                          CTG {it.viajeElegido.ctg}
                        </span>
                      )}
                      {repetido && (
                        <span className="text-xs text-destructive">
                          Otro archivo de esta tanda también apunta a este viaje.
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {ETIQUETAS_ESTADO_ITEM[it.estado]}
                        {it.estado === "error" && it.error ? ` — ${it.error}` : ""}
                      </span>
                      {it.estado === "listo" && (
                        <Button size="sm" onClick={() => confirmarRapido(it)} disabled={isPendingConfirmar}>
                          Confirmar
                        </Button>
                      )}
                      {(it.estado === "listo" || it.estado === "revisar") && (
                        <Button size="sm" variant="outline" onClick={() => abrirDetalle(it)}>
                          Ver detalle
                        </Button>
                      )}
                      {it.estado === "error" && (
                        <Button size="sm" variant="outline" onClick={() => procesarUno(it)}>
                          Reintentar
                        </Button>
                      )}
                      {it.estado === "confirmado" && it.viajeElegido && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/viajes/${it.viajeElegido.id}`}>Ver viaje #{it.viajeElegido.numero}</Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {idAbierto === it.id && (
                    <div className="flex flex-col gap-4 border-t pt-4">
                      {it.viajesEncontrados && it.viajesEncontrados.length > 1 && !it.viajeElegido && (
                        <PickerViajesEncontrados
                          viajes={it.viajesEncontrados}
                          ctgBuscado={it.ctgBuscado}
                          onElegir={(v) => elegirViajeEnDetalle(it.id, v)}
                        />
                      )}
                      {!it.viajesEncontrados?.length && (
                        <p className="text-sm text-muted-foreground">
                          {it.ctgBuscado
                            ? `No se encontró ningún viaje cargado con el CTG ${it.ctgBuscado}. Buscalo a mano en `
                            : "No se pudo leer el CTG de este archivo. Buscá el viaje a mano en "}
                          <Link href="/viajes" className="underline">
                            el listado de Viajes
                          </Link>
                          .
                        </p>
                      )}
                      {it.viajeElegido && it.datosExtraidos && (
                        <form
                          onSubmit={form.handleSubmit((valores) => confirmarValores(it.id, valores))}
                          className="flex flex-col gap-4"
                        >
                          <CamposRevisionDescarga
                            form={form}
                            viaje={it.viajeElegido}
                            datosExtraidos={it.datosExtraidos}
                            confirmaSobrescribir={confirmaSobrescribir}
                            onConfirmaSobrescribirChange={setConfirmaSobrescribir}
                          />
                          <div className="flex gap-3">
                            <Button
                              type="submit"
                              disabled={
                                isPendingConfirmar ||
                                (!!it.viajeElegido.fecha_descarga && !confirmaSobrescribir)
                              }
                            >
                              {isPendingConfirmar ? "Guardando..." : "Confirmar y cargar descarga"}
                            </Button>
                            <Button type="button" variant="outline" onClick={cerrarDetalle}>
                              Cerrar
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
