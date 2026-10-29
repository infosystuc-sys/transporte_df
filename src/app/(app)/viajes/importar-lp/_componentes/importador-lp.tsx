"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mensajeArchivoMuyPesado, prepararArchivoParaSubir } from "@/lib/archivos/preparar-subida";
import { diferenciasLp, nroFacturaLp } from "@/lib/lp/comparar";
import type { LineaRevisionLp, ResultadoLp, ViajeParaLp } from "@/lib/lp/importar";
import { confirmarLp, leerLp } from "../actions";

type ItemLp = {
  id: string;
  archivo: File;
  estado: "leyendo" | "listo" | "error" | "confirmado";
  resultado: Extract<ResultadoLp, { ok: true }> | null;
  error: string | null;
  /** Se incrementa en cada lectura: remonta la tarjeta con selección limpia. */
  lectura: number;
};

const pesos = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const fecha = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export function ImportadorLp() {
  const [items, setItems] = useState<ItemLp[]>([]);

  const actualizar = (id: string, cambios: Partial<ItemLp>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));

  async function leer(item: ItemLp) {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, estado: "leyendo", error: null, lectura: it.lectura + 1 } : it))
    );
    try {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      const r = await leerLp(formData);
      if (!r.ok) actualizar(item.id, { estado: "error", error: r.error, resultado: null });
      else actualizar(item.id, { estado: "listo", resultado: r });
    } catch (err) {
      console.error("leerLp falló:", err);
      actualizar(item.id, { estado: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function onSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = [...(e.target.files ?? [])];
    e.target.value = "";
    const nuevos: ItemLp[] = [];
    for (const original of archivos) {
      const archivo = await prepararArchivoParaSubir(original);
      const pesado = mensajeArchivoMuyPesado(archivo);
      if (pesado) {
        toast.error(pesado);
        continue;
      }
      nuevos.push({ id: crypto.randomUUID(), archivo, estado: "leyendo", resultado: null, error: null, lectura: 0 });
    }
    setItems((prev) => [...nuevos, ...prev]);
    // De a uno: cada lectura puede ir a la IA y conviene no saturarla.
    for (const item of nuevos) await leer(item);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-md border p-4">
        <Label htmlFor="archivos-lp">Líquidos producto (PDF o foto, podés elegir varios)</Label>
        <Input
          id="archivos-lp"
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
          onChange={onSeleccionar}
        />
      </div>

      {items.map((it) => (
        <TarjetaLp key={`${it.id}-${it.lectura}`} item={it} onReleer={() => leer(it)} onConfirmado={() => actualizar(it.id, { estado: "confirmado" })} />
      ))}
    </div>
  );
}

/** Una línea se puede confirmar si su viaje existe y no está facturado con otro comprobante. */
function estadoLinea(l: LineaRevisionLp, viaje: ViajeParaLp | undefined, nroFactura: string | null) {
  if (!viaje) return { importable: false, motivo: l.viajes.length === 0 ? "CTG no cargado en la app" : "Elegí el viaje" };
  if (viaje.factura_nro && viaje.factura_nro === nroFactura) return { importable: false, motivo: "Ya importado" };
  if (viaje.factura_nro) return { importable: false, motivo: `Ya facturado con ${viaje.factura_nro}` };
  return { importable: true, motivo: null };
}

function TarjetaLp({
  item,
  onReleer,
  onConfirmado,
}: {
  item: ItemLp;
  onReleer: () => void;
  onConfirmado: () => void;
}) {
  const r = item.resultado;
  // null = el leído del archivo; solo se edita a mano si el LP no lo trae.
  const [numeroEditado, setNumero] = useState<string | null>(null);
  const numero = numeroEditado ?? r?.lp.numero ?? "";
  // viaje elegido por línea (índice de la línea → id del viaje)
  const [elegidos, setElegidos] = useState<Record<number, number>>({});
  const [desmarcadas, setDesmarcadas] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (item.estado === "leyendo") {
    return <div className="rounded-md border p-4 text-sm text-muted-foreground">Leyendo {item.archivo.name}…</div>;
  }
  if (item.estado === "error" || !r) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>{item.archivo.name}</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          {item.error}
          <Button size="sm" variant="outline" className="w-fit" onClick={onReleer}>
            Volver a leer
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const nroFactura = numero.trim() ? nroFacturaLp(numero.trim()) : null;
  const filas = r.lineas.map((l, i) => {
    const viaje = l.viajes.find((v) => v.id === elegidos[i]) ?? (l.viajes.length === 1 ? l.viajes[0] : undefined);
    const estado = estadoLinea(l, viaje, nroFactura);
    const marcada = estado.importable && !desmarcadas.has(i);
    return { l, i, viaje, estado, marcada };
  });
  const aConfirmar = filas.filter((f) => f.marcada && f.viaje);
  const totalNeto = aConfirmar.reduce((s, f) => s + f.l.neto, 0);
  const alicuotaIva = r.lp.iva != null && r.lp.neto_gravado ? r.lp.iva / r.lp.neto_gravado : 0.21;

  function confirmar() {
    const emisor = r?.emisor;
    if (!r || !emisor || aConfirmar.length === 0) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      formData.set(
        "datos",
        JSON.stringify({
          numero: numero.trim(),
          fecha: r.lp.fecha,
          emisor_id: emisor.id,
          alicuota_iva: alicuotaIva,
          lineas: aConfirmar.map((f) => ({
            viaje_id: f.viaje!.id,
            total: f.l.linea.total,
            comision: f.l.linea.comision,
            otros_descuentos: f.l.linea.otros_descuentos,
          })),
        })
      );
      try {
        const res = await confirmarLp(formData);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(`Líquido producto ${numero} cargado en ${res.confirmados} viaje(s).`);
        onConfirmado();
      } catch (err) {
        console.error("confirmarLp falló:", err);
        toast.error(`No se pudo confirmar: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-bold">
            Líquido producto {r.lp.numero ?? "(sin número)"} · {fecha(r.lp.fecha)}
          </h3>
          <p className="text-sm text-muted-foreground">
            Emisor: {r.emisor?.razon_social ?? "no cargado"} (CUIT {r.lp.emisor_cuit ?? "sin leer"}) · Neto{" "}
            {pesos(r.lp.neto_gravado)} · IVA {pesos(r.lp.iva)} · Total {pesos(r.lp.total)}
          </p>
          <p className="text-xs text-muted-foreground">{item.archivo.name}</p>
        </div>
        <div className="flex gap-2">
          {r.fuente === "ia" && <Badge variant="outline">Leído con IA: revisalo con cuidado</Badge>}
          {item.estado === "confirmado" && <Badge variant="success">Confirmado</Badge>}
        </div>
      </div>

      {!r.emisor && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>El emisor no está cargado como cliente</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              Agregá el CUIT {r.lp.emisor_cuit ?? "del emisor"} en{" "}
              <Link href="/clientes?tab=comisiones" target="_blank" className="underline">
                Clientes → Comisiones
              </Link>{" "}
              (con su % de comisión) y volvé a leer el archivo.
            </span>
            <Button size="sm" variant="outline" className="w-fit" onClick={onReleer}>
              Volver a leer
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {r.avisos.map((a) => (
        <p key={a} className="rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
          {a}
        </p>
      ))}
      {!r.lp.numero && (
        <div className="flex max-w-xs flex-col gap-2">
          <Label htmlFor={`nro-${item.id}`}>N° del líquido producto</Label>
          <Input id={`nro-${item.id}`} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="A0002-00007078" />
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>CTG</TableHead>
              <TableHead>Viaje</TableHead>
              <TableHead className="text-right">Kg</TableHead>
              <TableHead className="text-right">Tarifa</TableHead>
              <TableHead className="text-right">Flete</TableHead>
              <TableHead className="text-right">Comisión</TableHead>
              <TableHead className="text-right">Neto</TableHead>
              <TableHead>Control</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map(({ l, i, viaje, estado, marcada }) => {
              const difs = viaje ? diferenciasLp(l.linea, l.comision_pct, viaje) : [];
              const cambiaCliente = viaje && r.emisor && viaje.cliente_id !== r.emisor.id;
              return (
                <TableRow key={`${l.linea.ctg}-${i}`}>
                  <TableCell>
                    <Checkbox
                      checked={marcada}
                      disabled={!estado.importable || item.estado === "confirmado"}
                      onCheckedChange={(v) =>
                        setDesmarcadas((prev) => {
                          const copia = new Set(prev);
                          if (v) copia.delete(i);
                          else copia.add(i);
                          return copia;
                        })
                      }
                      aria-label={`Incluir CTG ${l.linea.ctg}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.linea.ctg}</TableCell>
                  <TableCell>
                    {l.viajes.length > 1 ? (
                      <select
                        className="rounded-sm border bg-background px-2 py-1 text-sm"
                        value={viaje?.id ?? ""}
                        onChange={(e) => setElegidos((prev) => ({ ...prev, [i]: Number(e.target.value) }))}
                      >
                        <option value="">Elegir…</option>
                        {l.viajes.map((v) => (
                          <option key={v.id} value={v.id}>
                            #{v.numero ?? v.id}
                          </option>
                        ))}
                      </select>
                    ) : viaje ? (
                      <Link href={`/viajes/${viaje.id}`} target="_blank" className="underline">
                        #{viaje.numero ?? viaje.id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">{l.linea.kg?.toLocaleString("es-AR") ?? "—"}</TableCell>
                  <TableCell className="text-right">{pesos(l.linea.tarifa)}</TableCell>
                  <TableCell className="text-right">{pesos(l.linea.total)}</TableCell>
                  <TableCell className="text-right">
                    {pesos(l.linea.comision)}
                    {l.comision_pct != null && (
                      <span className="block text-xs text-muted-foreground">
                        {l.comision_pct.toLocaleString("es-AR", { maximumFractionDigits: 3 })}%
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{pesos(l.neto)}</TableCell>
                  <TableCell className="min-w-56">
                    <div className="flex flex-col gap-1 text-xs">
                      {estado.motivo && <Badge variant={estado.motivo === "Ya importado" ? "success" : "destructive"}>{estado.motivo}</Badge>}
                      {estado.importable && difs.length === 0 && <Badge variant="success">Coincide</Badge>}
                      {difs.map((d) => (
                        <span key={d.campo} className="text-destructive">
                          {d.campo}: LP {d.lp} · app {d.app}
                        </span>
                      ))}
                      {estado.importable && cambiaCliente && (
                        <span className="text-muted-foreground">
                          {viaje.tiene_cobros
                            ? `Cliente: queda ${viaje.cliente_nombre ?? "sin cliente"} (el viaje ya tiene cobros)`
                            : `Cliente: ${viaje.cliente_nombre ?? "sin cliente"} → ${r.emisor!.razon_social}`}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {item.estado !== "confirmado" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Se va a cargar como factura <strong>{nroFactura ?? "LP (sin número)"}</strong> en {aConfirmar.length} viaje(s) ·
            neto {pesos(totalNeto)} + IVA {pesos(totalNeto * alicuotaIva)}. Los kilos y la tarifa del viaje no se
            modifican: si hay diferencias, corregilas en el viaje.
          </p>
          <Button onClick={confirmar} disabled={isPending || !r.emisor || !nroFactura || !r.lp.fecha || aConfirmar.length === 0}>
            {isPending ? "Confirmando..." : `Confirmar ${aConfirmar.length} viaje(s)`}
          </Button>
        </div>
      )}
    </div>
  );
}
