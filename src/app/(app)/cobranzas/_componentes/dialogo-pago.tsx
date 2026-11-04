"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { camposFaltantesEcheq, clasificarMedioPago } from "@/lib/cobros/medio-pago";
import { marcarPagados } from "../actions";
import { pesos } from "./formato";
import type { LpCobranza } from "./panel-cobranzas";

type Pago = {
  id: string;
  medio_pago_id: string;
  importe: string;
  banco: string;
  cheque_nro: string;
  cheque_vto: string;
};

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** "1.234.567,89" o "1234567.89" → número. */
const numero = (v: string) => {
  const t = v.trim();
  if (!t) return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};
const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";

/**
 * Registra el pago de uno o varios LP del mismo cliente. Se pueden cargar
 * varios pagos (ej. una orden de pago con tres eCheq): cada uno queda como
 * un cobro, con los datos del eCheq obligatorios.
 */
export function DialogoPago({
  cliente,
  lps,
  medios,
  onCerrar,
}: {
  cliente: string;
  lps: LpCobranza[];
  medios: { id: number; nombre: string }[];
  onCerrar: (pagado: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const total = Math.round(lps.reduce((s, l) => s + l.total, 0) * 100) / 100;
  const medioEcheq = medios.find((m) => clasificarMedioPago(m.nombre) === "echeq");

  const [fechaPago, setFechaPago] = useState(hoy());
  const [referencia, setReferencia] = useState("");
  const [pagos, setPagos] = useState<Pago[]>([
    {
      id: crypto.randomUUID(),
      medio_pago_id: medioEcheq ? String(medioEcheq.id) : "",
      importe: total.toFixed(2).replace(".", ","),
      banco: "",
      cheque_nro: "",
      cheque_vto: "",
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  const esEcheq = (p: Pago) => clasificarMedioPago(medios.find((m) => String(m.id) === p.medio_pago_id)?.nombre) === "echeq";
  const suma = pagos.reduce((s, p) => s + (Number.isNaN(numero(p.importe)) ? 0 : numero(p.importe)), 0);
  const diferencia = Math.round((total - suma) * 100) / 100;

  const cambiar = (id: string, cambios: Partial<Pago>) => setPagos((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));

  function agregar() {
    const ultimo = pagos[pagos.length - 1];
    setPagos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        medio_pago_id: ultimo?.medio_pago_id ?? "",
        importe: diferencia > 0 ? diferencia.toFixed(2).replace(".", ",") : "",
        banco: ultimo?.banco ?? "",
        cheque_nro: "",
        cheque_vto: "",
      },
    ]);
  }

  function guardar() {
    setError(null);
    for (const [i, p] of pagos.entries()) {
      if (!p.medio_pago_id) return setError(`Pago ${i + 1}: elegí el medio de pago.`);
      const imp = numero(p.importe);
      if (Number.isNaN(imp) || imp <= 0) return setError(`Pago ${i + 1}: el importe no es válido.`);
      if (esEcheq(p)) {
        const faltan = camposFaltantesEcheq({ ...p, cheque_vto: p.cheque_vto || null });
        if (faltan.length > 0) return setError(`Pago ${i + 1} (eCheq): ${faltan.map((f) => f.mensaje).join(" ")}`);
      }
    }
    startTransition(async () => {
      const r = await marcarPagados({
        lp_ids: lps.map((l) => l.id),
        fecha: fechaPago,
        referencia,
        pagos: pagos.map((p) => ({
          medio_pago_id: Number(p.medio_pago_id),
          importe: numero(p.importe),
          banco: p.banco,
          cheque_nro: p.cheque_nro,
          cheque_vto: p.cheque_vto || undefined,
        })),
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      toast.success(lps.length === 1 ? `LP ${lps[0].numero} marcado como pagado.` : `${lps.length} LP marcados como pagados.`);
      onCerrar(true);
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !isPending && onCerrar(false)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar pago · {cliente}</DialogTitle>
          <DialogDescription>
            {lps.length === 1 ? `LP ${lps[0].numero}` : `${lps.length} LP: ${lps.map((l) => l.numero).join(", ")}`} · total{" "}
            {pesos(total)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="fecha-pago">Fecha del pago</Label>
            <Input id="fecha-pago" type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="referencia-pago">N° de orden de pago (opcional)</Label>
            <Input id="referencia-pago" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {pagos.map((p, i) => (
            <div key={p.id} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Pago {i + 1}</p>
                {pagos.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => setPagos((prev) => prev.filter((x) => x.id !== p.id))} aria-label="Quitar pago">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label>Medio de pago</Label>
                  <select className={select} value={p.medio_pago_id} onChange={(e) => cambiar(p.id, { medio_pago_id: e.target.value })}>
                    <option value="">Elegir…</option>
                    {medios.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Importe ($)</Label>
                  <Input inputMode="decimal" value={p.importe} onChange={(e) => cambiar(p.id, { importe: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{esEcheq(p) ? "Banco emisor *" : "Banco"}</Label>
                  <Input value={p.banco} onChange={(e) => cambiar(p.id, { banco: e.target.value })} />
                </div>
                {esEcheq(p) && (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label>N° de eCheq *</Label>
                      <Input value={p.cheque_nro} onChange={(e) => cambiar(p.id, { cheque_nro: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Fecha de cobro del eCheq *</Label>
                      <Input type="date" value={p.cheque_vto} onChange={(e) => cambiar(p.id, { cheque_vto: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-fit" onClick={agregar}>
            <Plus className="size-4" />
            Agregar otro pago (otro eCheq, transferencia…)
          </Button>
        </div>

        <div className="rounded-md bg-muted/40 p-3 text-sm">
          Pagos: <strong>{pesos(suma)}</strong> de {pesos(total)}.{" "}
          {Math.abs(diferencia) >= 0.01 &&
            (diferencia > 0
              ? `Faltan ${pesos(diferencia)}: el LP queda pagado igual y esa diferencia queda como saldo en los viajes.`
              : `Sobran ${pesos(-diferencia)}: el excedente queda en el cobro sin imputar a ningún viaje.`)}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onCerrar(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={isPending}>
            {isPending ? "Guardando..." : "Marcar como pagado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
