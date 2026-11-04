"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mensajeArchivoMuyPesado, prepararArchivoParaSubir } from "@/lib/archivos/preparar-subida";
import type { ResultadoCargaLp } from "@/lib/lp/vincular";
import { cargarLp } from "../../actions";

type Item = {
  id: string;
  archivo: File;
  estado: "esperando" | "cargando" | "listo";
  resultado: ResultadoCargaLp | null;
  numero: string;
};

const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const fecha = (iso: string) => iso.split("-").reverse().join("/");

export function CargadorLp() {
  const [items, setItems] = useState<Item[]>([]);

  const actualizar = (id: string, cambios: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));

  async function cargar(item: Item) {
    actualizar(item.id, { estado: "cargando" });
    let resultado: ResultadoCargaLp;
    try {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      if (item.numero.trim()) formData.set("numero", item.numero.trim());
      resultado = await cargarLp(formData);
    } catch (err) {
      console.error("cargarLp falló:", err);
      resultado = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    actualizar(item.id, { estado: "listo", resultado });
  }

  async function onSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = [...(e.target.files ?? [])];
    e.target.value = "";
    const nuevos: Item[] = [];
    for (const original of archivos) {
      const archivo = await prepararArchivoParaSubir(original);
      const pesado = mensajeArchivoMuyPesado(archivo);
      if (pesado) {
        toast.error(pesado);
        continue;
      }
      nuevos.push({ id: crypto.randomUUID(), archivo, estado: "esperando", resultado: null, numero: "" });
    }
    setItems((prev) => [...nuevos, ...prev]);
    // De a uno: cada lectura puede ir a la IA y conviene no saturarla.
    for (const item of nuevos) await cargar(item);
  }

  const listos = items.filter((i) => i.resultado?.ok);
  const conProblemas = items.filter((i) => i.resultado && (!i.resultado.ok || i.resultado.sin_vincular > 0));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-md border p-4">
        <Label htmlFor="archivos-lp">Líquidos producto (PDF o foto, podés elegir varios a la vez)</Label>
        <Input
          id="archivos-lp"
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
          onChange={onSeleccionar}
        />
      </div>

      {items.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {listos.length} de {items.length} cargado(s)
          {conProblemas.length > 0 && ` · ${conProblemas.length} para revisar`}.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {items.map((it) => (
          <TarjetaCarga
            key={it.id}
            item={it}
            onNumero={(numero) => actualizar(it.id, { numero })}
            onReintentar={() => cargar(it)}
          />
        ))}
      </div>
    </div>
  );
}

function TarjetaCarga({
  item,
  onNumero,
  onReintentar,
}: {
  item: Item;
  onNumero: (v: string) => void;
  onReintentar: () => void;
}) {
  const r = item.resultado;
  if (item.estado !== "listo" || !r) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {item.estado === "cargando" ? "Leyendo y vinculando" : "En espera"}: {item.archivo.name}
      </div>
    );
  }

  if (!r.ok) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-destructive/40 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold">{item.archivo.name}</p>
            <p className="text-sm text-destructive">{r.error}</p>
            {r.error.includes("Clientes") && (
              <Link href="/clientes?tab=comisiones" target="_blank" className="text-sm underline">
                Abrir Clientes → Comisiones
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {r.falta_numero && (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`nro-${item.id}`}>N° del líquido producto</Label>
              <Input
                id={`nro-${item.id}`}
                className="w-56"
                value={item.numero}
                onChange={(e) => onNumero(e.target.value)}
                placeholder="A0002-00007078"
              />
            </div>
          )}
          <Button size="sm" variant="outline" onClick={onReintentar} disabled={r.falta_numero && !item.numero.trim()}>
            Volver a intentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pos" />
          <div>
            <p className="text-sm font-bold">
              LP {r.numero} · {r.cliente} · {fecha(r.fecha)} · {pesos(r.total)}
            </p>
            <p className="text-xs text-muted-foreground">{item.archivo.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {!r.nuevo && <Badge variant="outline">Ya estaba cargado</Badge>}
          {r.fuente === "ia" && <Badge variant="outline">Leído con IA</Badge>}
          <Badge variant="success">{r.vinculadas} viaje(s) vinculado(s)</Badge>
          {r.sin_vincular > 0 && <Badge variant="destructive">{r.sin_vincular} CPE sin vincular</Badge>}
        </div>
      </div>
      {r.avisos.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
          {r.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <Link href={`/cobranzas?lp=${r.lp_id}`} className="w-fit text-sm underline">
        Ver en Cobranzas
      </Link>
    </div>
  );
}
