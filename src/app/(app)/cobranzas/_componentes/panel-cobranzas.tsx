"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, ChevronRight, FileText, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { desmarcarPagado, eliminarLp, revincularLp, urlPdfLp } from "../actions";
import { DialogoPago } from "./dialogo-pago";
import { fecha, pesos } from "./formato";

export type LineaCobranza = {
  id: number;
  ctg: string;
  viaje_id: number | null;
  viaje_numero: number | null;
  chofer: string | null;
  fecha_descarga: string | null;
  kg: number | null;
  tarifa: number | null;
  flete: number;
  comision: number;
  otros_descuentos: number;
  neto: number;
  total: number;
  saldo: number | null;
  aviso: string | null;
  diferencias: string[];
};

export type LpCobranza = {
  id: number;
  numero: string;
  fecha: string;
  neto: number;
  iva: number;
  total: number;
  leido_con_ia: boolean;
  tiene_pdf: boolean;
  pagado: boolean;
  fecha_pago: string | null;
  lineas: LineaCobranza[];
};

export type ViajeSinLp = {
  id: number;
  numero: number;
  ctg: string | null;
  fecha_descarga: string | null;
  chofer: string | null;
  total_a_cobrar: number | null;
  factura_nro: string | null;
};

export type ClienteCobranza = {
  id: number;
  nombre: string;
  cuit: string | null;
  lps: LpCobranza[];
  sin_lp: ViajeSinLp[];
};

type Filtro = "pendientes" | "pagados" | "todos";


export function PanelCobranzas({
  clientes,
  medios,
  lpDestacado,
}: {
  clientes: ClienteCobranza[];
  medios: { id: number; nombre: string }[];
  lpDestacado: number | null;
}) {
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return clientes
      .filter((c) => !q || c.nombre.toLowerCase().includes(q) || (c.cuit ?? "").includes(q))
      .map((c) => ({
        ...c,
        lps: c.lps.filter((lp) => filtro === "todos" || (filtro === "pagados" ? lp.pagado : !lp.pagado)),
        sin_lp: filtro === "pagados" ? [] : c.sin_lp,
      }))
      .filter((c) => c.lps.length > 0 || c.sin_lp.length > 0);
  }, [clientes, filtro, busqueda]);

  const totalPendiente = clientes.reduce((s, c) => s + c.lps.filter((l) => !l.pagado).reduce((t, l) => t + l.total, 0), 0);
  const lpsPendientes = clientes.reduce((s, c) => s + c.lps.filter((l) => !l.pagado).length, 0);
  const viajesSinLp = clientes.reduce((s, c) => s + c.sin_lp.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Resumen titulo="LP pendientes de pago" valor={String(lpsPendientes)} />
        <Resumen titulo="A cobrar por LP (con IVA)" valor={pesos(totalPendiente)} />
        <Resumen titulo="Viajes sin LP todavía" valor={String(viajesSinLp)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["pendientes", "pagados", "todos"] as const).map((f) => (
          <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} onClick={() => setFiltro(f)}>
            {f === "pendientes" ? "Pendientes" : f === "pagados" ? "Pagados" : "Todos"}
          </Button>
        ))}
        <Input
          className="ml-auto w-full sm:w-64"
          placeholder="Buscar cliente o CUIT"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          {clientes.length === 0 ? (
            <>
              Todavía no hay líquidos producto cargados.{" "}
              <Link href="/cobranzas/cargar-lp" className="underline">
                Cargá los primeros
              </Link>
              .
            </>
          ) : (
            "No hay nada para mostrar con este filtro."
          )}
        </p>
      ) : (
        visibles.map((c) => (
          <TarjetaCliente
            key={c.id}
            cliente={c}
            medios={medios}
            lpDestacado={lpDestacado}
            abiertoInicial={visibles.length <= 3 || c.lps.some((l) => l.id === lpDestacado)}
          />
        ))
      )}
    </div>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-[11.5px] font-bold uppercase tracking-[0.03em] text-muted-foreground">{titulo}</p>
      <p className="text-[20px] font-extrabold">{valor}</p>
    </div>
  );
}

function TarjetaCliente({
  cliente,
  medios,
  lpDestacado,
  abiertoInicial,
}: {
  cliente: ClienteCobranza;
  medios: { id: number; nombre: string }[];
  lpDestacado: number | null;
  abiertoInicial: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [verSinLp, setVerSinLp] = useState(false);
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [pagando, setPagando] = useState<LpCobranza[] | null>(null);

  const pendientes = cliente.lps.filter((l) => !l.pagado);
  const aPagar = pendientes.filter((l) => elegidos.has(l.id));
  const totalPendiente = pendientes.reduce((s, l) => s + l.total, 0);
  const todosElegidos = pendientes.length > 0 && aPagar.length === pendientes.length;

  const alternar = (id: number, marcado: boolean) =>
    setElegidos((prev) => {
      const copia = new Set(prev);
      if (marcado) copia.add(id);
      else copia.delete(id);
      return copia;
    });

  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
        onClick={() => setAbierto((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {abierto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <div>
            <p className="font-bold">{cliente.nombre}</p>
            {cliente.cuit && <p className="text-xs text-muted-foreground">CUIT {cliente.cuit}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {pendientes.length > 0 && (
            <Badge variant="destructive">
              {pendientes.length} LP pendiente(s) · {pesos(totalPendiente)}
            </Badge>
          )}
          {cliente.lps.length > pendientes.length && (
            <Badge variant="success">{cliente.lps.length - pendientes.length} pagado(s)</Badge>
          )}
          {cliente.sin_lp.length > 0 && <Badge variant="outline">{cliente.sin_lp.length} viaje(s) sin LP</Badge>}
        </div>
      </button>

      {abierto && (
        <div className="flex flex-col gap-3 border-t p-4">
          {pendientes.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={todosElegidos}
                  onCheckedChange={(v) => setElegidos(v ? new Set(pendientes.map((l) => l.id)) : new Set())}
                  aria-label="Elegir todos los LP pendientes"
                />
                Elegir todos los pendientes
              </label>
              <Button size="sm" disabled={aPagar.length === 0} onClick={() => setPagando(aPagar)}>
                Marcar {aPagar.length || ""} como pagado(s)
                {aPagar.length > 0 && ` · ${pesos(aPagar.reduce((s, l) => s + l.total, 0))}`}
              </Button>
            </div>
          )}

          {cliente.lps.map((lp) => (
            <FilaLp
              key={lp.id}
              lp={lp}
              elegido={elegidos.has(lp.id)}
              onElegir={(v) => alternar(lp.id, v)}
              onPagar={() => setPagando([lp])}
              destacado={lp.id === lpDestacado}
            />
          ))}

          {cliente.sin_lp.length > 0 && (
            <div className="rounded-md border border-dashed">
              <button
                type="button"
                className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium"
                onClick={() => setVerSinLp((v) => !v)}
              >
                {verSinLp ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                Viajes sin líquido producto ({cliente.sin_lp.length}): falta que el cliente los liquide
              </button>
              {verSinLp && (
                <div className="overflow-x-auto border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Viaje</TableHead>
                        <TableHead>Carta de porte</TableHead>
                        <TableHead>Descarga</TableHead>
                        <TableHead>Chofer</TableHead>
                        <TableHead>Factura cargada</TableHead>
                        <TableHead className="text-right">A cobrar (sin IVA)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cliente.sin_lp.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>
                            <Link href={`/viajes/${v.id}`} className="underline">
                              #{v.numero}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{v.ctg ?? "—"}</TableCell>
                          <TableCell>{fecha(v.fecha_descarga)}</TableCell>
                          <TableCell>{v.chofer ?? "—"}</TableCell>
                          <TableCell>{v.factura_nro ?? "—"}</TableCell>
                          <TableCell className="text-right">{pesos(v.total_a_cobrar)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pagando && (
        <DialogoPago
          cliente={cliente.nombre}
          lps={pagando}
          medios={medios}
          onCerrar={(pagado) => {
            setPagando(null);
            if (pagado) setElegidos(new Set());
          }}
        />
      )}
    </div>
  );
}

function FilaLp({
  lp,
  elegido,
  onElegir,
  onPagar,
  destacado,
}: {
  lp: LpCobranza;
  elegido: boolean;
  onElegir: (v: boolean) => void;
  onPagar: () => void;
  destacado: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(destacado);
  const [isPending, startTransition] = useTransition();

  const sinVincular = lp.lineas.filter((l) => l.viaje_id == null).length;
  const conDiferencias = lp.lineas.filter((l) => l.diferencias.length > 0).length;

  function verPdf() {
    // La pestaña se abre antes del await: si no, el navegador la bloquea.
    const ventana = window.open("", "_blank");
    startTransition(async () => {
      const r = await urlPdfLp(lp.id);
      if (r.error || !r.url) {
        ventana?.close();
        toast.error(r.error ?? "No se pudo abrir el PDF.");
        return;
      }
      if (ventana) ventana.location.href = r.url;
    });
  }

  function revincular() {
    startTransition(async () => {
      const r = await revincularLp(lp.id);
      const quedan = r.avisos.length;
      if (quedan === 0) toast.success("Listo: se vincularon todas las cartas de porte.");
      else toast.warning(`Siguen ${quedan} sin vincular: ${r.avisos.join(" ")}`);
      router.refresh();
    });
  }

  function desmarcar() {
    startTransition(async () => {
      const r = await desmarcarPagado(lp.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const otros = (r.desmarcados ?? []).filter((n) => n !== lp.numero);
      toast.success(
        otros.length > 0
          ? `LP ${lp.numero} vuelve a pendiente, junto con ${otros.join(", ")} (se pagaron juntos).`
          : `LP ${lp.numero} vuelve a pendiente.`
      );
      router.refresh();
    });
  }

  function eliminar() {
    startTransition(async () => {
      const r = await eliminarLp(lp.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`LP ${lp.numero} eliminado.`);
      router.refresh();
    });
  }

  return (
    <div className={cn("rounded-md border", destacado && "ring-2 ring-primary/40")}>
      <div className="flex flex-wrap items-center gap-3 p-3">
        {!lp.pagado ? (
          <Checkbox checked={elegido} onCheckedChange={(v) => onElegir(!!v)} aria-label={`Elegir LP ${lp.numero}`} />
        ) : (
          <span className="w-4" />
        )}
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setAbierto((v) => !v)}>
          {abierto ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-bold">
              LP {lp.numero} · {fecha(lp.fecha)}
            </p>
            <p className="text-xs text-muted-foreground">
              {lp.lineas.length} viaje(s) · neto {pesos(lp.neto)} · IVA {pesos(lp.iva)}
            </p>
          </div>
        </button>
        <div className="flex flex-wrap items-center gap-1">
          {sinVincular > 0 && <Badge variant="destructive">{sinVincular} sin vincular</Badge>}
          {conDiferencias > 0 && <Badge variant="outline">{conDiferencias} con diferencias</Badge>}
          {lp.leido_con_ia && <Badge variant="outline">Leído con IA</Badge>}
          {lp.pagado ? (
            <Badge variant="success">Pagado {fecha(lp.fecha_pago)}</Badge>
          ) : (
            <Badge variant="secondary">Pendiente</Badge>
          )}
        </div>
        <p className="w-32 text-right font-bold">{pesos(lp.total)}</p>
        <div className="flex flex-wrap items-center gap-1">
          {!lp.pagado && (
            <Button size="sm" onClick={onPagar} disabled={isPending}>
              Marcar pagado
            </Button>
          )}
          {lp.pagado && (
            <Confirmar
              titulo={`¿Volver el LP ${lp.numero} a pendiente?`}
              descripcion="Se borran los cobros con los que se registró el pago. Si ese pago cubría otros LP, también vuelven a pendiente."
              accion="Volver a pendiente"
              onConfirmar={desmarcar}
              disabled={isPending}
            >
              <Button size="sm" variant="outline" disabled={isPending}>
                <Undo2 className="size-4" />
                Desmarcar
              </Button>
            </Confirmar>
          )}
          {lp.tiene_pdf && (
            <Button size="icon" variant="ghost" onClick={verPdf} disabled={isPending} aria-label="Ver PDF">
              <FileText className="size-4" />
            </Button>
          )}
          {!lp.pagado && (
            <Confirmar
              titulo={`¿Eliminar el LP ${lp.numero}?`}
              descripcion="Los viajes vinculados pierden la facturación de este LP y vuelven a figurar sin LP. Se puede volver a cargar el archivo después."
              accion="Eliminar"
              onConfirmar={eliminar}
              disabled={isPending}
            >
              <Button size="icon" variant="ghost" disabled={isPending} aria-label="Eliminar LP">
                <Trash2 className="size-4" />
              </Button>
            </Confirmar>
          )}
        </div>
      </div>

      {abierto && (
        <div className="flex flex-col gap-2 border-t p-3">
          {sinVincular > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                Hay cartas de porte sin vincular. Cargá o corregí el viaje y después buscalo de nuevo.
              </span>
              <Button size="sm" variant="outline" onClick={revincular} disabled={isPending}>
                <RefreshCw className="size-4" />
                Buscar viajes de nuevo
              </Button>
            </div>
          )}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Viaje</TableHead>
                  <TableHead>Carta de porte</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead className="text-right">Kg</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead className="text-right">Flete</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">Total c/IVA</TableHead>
                  <TableHead>Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lp.lineas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      {l.viaje_id ? (
                        <Link href={`/viajes/${l.viaje_id}`} className="underline">
                          #{l.viaje_numero}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.ctg}</TableCell>
                    <TableCell>{l.chofer ?? "—"}</TableCell>
                    <TableCell className="text-right">{l.kg?.toLocaleString("es-AR") ?? "—"}</TableCell>
                    <TableCell className="text-right">{pesos(l.tarifa)}</TableCell>
                    <TableCell className="text-right">{pesos(l.flete)}</TableCell>
                    <TableCell className="text-right">
                      {l.comision > 0 ? `−${pesos(l.comision)}` : "—"}
                      {l.otros_descuentos > 0 && (
                        <span className="block text-xs text-muted-foreground">otros −{pesos(l.otros_descuentos)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{pesos(l.neto)}</TableCell>
                    <TableCell className="text-right font-medium">{pesos(l.total)}</TableCell>
                    <TableCell className="min-w-56 text-xs">
                      {l.viaje_id == null ? (
                        <span className="text-destructive">{l.aviso ?? "Sin vincular."}</span>
                      ) : l.diferencias.length === 0 ? (
                        <Badge variant="success">Coincide</Badge>
                      ) : (
                        <span className="flex flex-col gap-0.5 text-destructive">
                          {l.diferencias.map((d) => (
                            <span key={d}>{d}</span>
                          ))}
                        </span>
                      )}
                      {l.viaje_id != null && l.aviso && <span className="block text-muted-foreground">{l.aviso}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function Confirmar({
  titulo,
  descripcion,
  accion,
  onConfirmar,
  disabled,
  children,
}: {
  titulo: string;
  descripcion: string;
  accion: string;
  onConfirmar: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={disabled} onClick={onConfirmar}>
            {accion}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
