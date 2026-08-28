"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";
import type { ResultadoImportacionCpe } from "@/lib/cpe/importar";
import { agruparFaltantes, type GrupoFaltante } from "../../importar-cpe/_componentes/campos-revision-cpe";
import { crearEntidadesFaltantes, importarCpe } from "../../importar-cpe/actions";

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
  const [isPendingFaltantes, startTransitionFaltantes] = useTransition();

  const todosListos = items.length > 0 && !procesando;
  const grupos = useMemo(
    () => agruparFaltantes(items.flatMap((it) => it.resultado?.faltantes ?? [])),
    [items]
  );

  function darDeAltaFaltantesGlobal() {
    startTransitionFaltantes(async () => {
      // Cada item aporta sus propios faltantes con la clave prefijada por su
      // id: los `clave` que arma detectarFaltantes son roles fijos
      // ("cliente", "chofer", ...) que se repiten en cada CPE -- sin
      // prefijar, dos archivos con faltantes de rol "cliente" pero de
      // registros DISTINTOS pisarían la misma entrada en el resultado.
      const faltantesConClavePrefijada = items.flatMap(
        (it) =>
          it.resultado?.faltantes.map((f) => ({ ...f, clave: `${it.id}:${f.clave}` })) ?? []
      );
      if (faltantesConClavePrefijada.length === 0) return;

      const r = await crearEntidadesFaltantes({ faltantes: faltantesConClavePrefijada });
      if (r.error || !r.creadas) {
        toast.error(r.error ?? "No se pudieron dar de alta los registros.");
        return;
      }
      const creadas = r.creadas;

      setItems((prev) =>
        prev.map((it) => {
          if (!it.resultado) return it;
          const coincidencias = { ...it.resultado.coincidencias };
          const faltantesRestantes = it.resultado.faltantes.filter((f) => {
            const id = creadas[`${it.id}:${f.clave}`];
            if (id == null) return true;
            (coincidencias as Record<string, number | null>)[f.campo] = id;
            return false;
          });
          return { ...it, resultado: { ...it.resultado, coincidencias, faltantes: faltantesRestantes } };
        })
      );

      toast.success(
        grupos.length === 1 ? "Se dio de alta 1 registro." : `Se dieron de alta ${grupos.length} registros.`
      );
    });
  }

  function descartarFaltantesGlobal() {
    setItems((prev) =>
      prev.map((it) => (it.resultado ? { ...it, resultado: { ...it.resultado, faltantes: [] } } : it))
    );
  }

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

      {todosListos && grupos.length > 0 && (
        <div className="flex flex-col gap-3 rounded-md border border-amber/40 bg-amber/10 p-4">
          <div>
            <h3 className="text-sm font-bold">
              {grupos.length === 1
                ? "Falta dar de alta 1 registro"
                : `Faltan dar de alta ${grupos.length} registros`}
            </h3>
            <p className="text-sm text-muted-foreground">
              Contando todos los archivos de esta tanda. Revisá que estén bien leídos y confirmá para
              crearlos y dejarlos asignados a los viajes que los necesitan.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {grupos.map((g: GrupoFaltante) => (
              <li key={g.huella} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md bg-card p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{g.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.documento && `${g.documento} · `}usar como {g.roles.join(", ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={darDeAltaFaltantesGlobal} disabled={isPendingFaltantes}>
              {isPendingFaltantes
                ? "Dando de alta..."
                : grupos.length === 1
                  ? "Dar de alta 1 registro"
                  : `Dar de alta los ${grupos.length}`}
            </Button>
            <button type="button" onClick={descartarFaltantesGlobal} className="text-xs text-muted-foreground hover:underline">
              Los cargo a mano
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
