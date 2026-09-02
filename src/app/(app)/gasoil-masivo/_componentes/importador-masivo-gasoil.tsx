// src/app/(app)/gasoil-masivo/_componentes/importador-masivo-gasoil.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cargaGasoilSchema, type CargaGasoilInput } from "@/lib/schemas/gasoil";
import { previsualizarComprobante } from "@/lib/comprobantes/actions";
import type { ComprobanteExtraido } from "@/lib/comprobantes/claude";
import type { OpcionGasoil } from "@/lib/gasoil/datos-catalogos";
import { crearCargaGasoilConAdjunto } from "../../gasoil/actions";
import { CamposRevisionGasoil, construirValoresGasoil } from "../../gasoil/_componentes/campos-revision-gasoil";

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
  const [items, setItems] = useState<ItemLoteGasoil[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [idAbierto, setIdAbierto] = useState<string | null>(null);
  const [isPendingConfirmar, startTransitionConfirmar] = useTransition();

  const form = useForm<CargaGasoilInput>({ resolver: zodResolver(cargaGasoilSchema) });

  // Aviso, no bloqueo -- pedido explícito del cliente. A diferencia de
  // Descarga, acá cada fila da de alta un registro nuevo e independiente
  // (no hay "el mismo viaje" que se pueda pisar), así que no hace falta
  // ninguna lógica de downgrade al confirmar una de las dos.
  const duplicadosEnLote = useMemo(() => {
    const claves = new Map<string, number>();
    for (const it of items) {
      const camionId = it.datosExtraidos?.camion_id;
      const fecha = it.datosExtraidos?.fecha;
      if (camionId == null || !fecha) continue;
      const clave = `${camionId}:${fecha}`;
      claves.set(clave, (claves.get(clave) ?? 0) + 1);
    }
    const repetidas = new Set([...claves.entries()].filter(([, n]) => n > 1).map(([k]) => k));
    return (it: ItemLoteGasoil) => {
      const camionId = it.datosExtraidos?.camion_id;
      const fecha = it.datosExtraidos?.fecha;
      if (camionId == null || !fecha) return false;
      return repetidas.has(`${camionId}:${fecha}`);
    };
  }, [items]);

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

  function abrirDetalle(item: ItemLoteGasoil) {
    setIdAbierto(item.id);
    if (item.datosExtraidos) {
      form.reset(construirValoresGasoil(item.datosExtraidos));
    }
  }

  function cerrarDetalle() {
    setIdAbierto(null);
  }

  async function confirmarValores(itemId: string, valores: CargaGasoilInput) {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    startTransitionConfirmar(async () => {
      try {
        const formData = new FormData();
        formData.set("archivo", item.archivo);
        formData.set("datos", JSON.stringify(valores));
        const r = await crearCargaGasoilConAdjunto(formData);
        if (r?.error) {
          toast.error(r.error);
          return;
        }
        actualizarItem(itemId, { estado: "confirmado" });
        toast.success("Carga de gasoil registrada.");
        if (idAbierto === itemId) setIdAbierto(null);
      } catch (err) {
        console.error("crearCargaGasoilConAdjunto falló:", err);
        const mensaje = err instanceof Error ? err.message : String(err);
        toast.error(`No se pudo registrar la carga: ${mensaje}`);
      }
    });
  }

  function confirmarRapido(item: ItemLoteGasoil) {
    if (!item.datosExtraidos) return;
    const valores = construirValoresGasoil(item.datosExtraidos);
    const parseado = cargaGasoilSchema.safeParse(valores);
    if (!parseado.success) {
      abrirDetalle(item);
      toast.error("Revisá los datos antes de confirmar esta fila.");
      return;
    }
    confirmarValores(item.id, valores);
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
          <ul className="flex flex-col gap-2">
            {items.map((it) => {
              const repetido = it.estado !== "confirmado" && duplicadosEnLote(it);
              const camionNombre =
                it.datosExtraidos?.camion_id != null
                  ? (camiones.find((c) => c.id === it.datosExtraidos!.camion_id)?.nombre ?? "—")
                  : null;
              return (
                <li key={it.id} className="flex flex-col gap-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{it.archivo.name}</span>
                      {camionNombre && (
                        <span className="text-xs text-muted-foreground">
                          Camión {camionNombre}
                          {it.datosExtraidos?.litros != null ? ` · ${it.datosExtraidos.litros} L` : ""}
                        </span>
                      )}
                      {repetido && (
                        <span className="text-xs text-destructive">
                          Otro archivo de esta tanda también apunta a este camión en la misma fecha.
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
                      {it.estado === "confirmado" && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/gasoil">Ver en Gasoil</Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {idAbierto === it.id && it.datosExtraidos && (
                    <div className="flex flex-col gap-4 border-t pt-4">
                      <form
                        onSubmit={form.handleSubmit((valores) => confirmarValores(it.id, valores))}
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                      >
                        <CamposRevisionGasoil
                          form={form}
                          camiones={camiones}
                          choferes={choferes}
                          estaciones={estaciones}
                          viajes={viajes}
                        />
                        <div className="flex gap-3 sm:col-span-2">
                          <Button type="submit" disabled={isPendingConfirmar}>
                            {isPendingConfirmar ? "Guardando..." : "Confirmar y registrar carga"}
                          </Button>
                          <Button type="button" variant="outline" onClick={cerrarDetalle}>
                            Cerrar
                          </Button>
                        </div>
                      </form>
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
