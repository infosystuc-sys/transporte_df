"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { crearClienteConComision, guardarComisionCliente } from "../actions";

type FilaComision = {
  id: number;
  razon_social: string;
  cuit: string | null;
  comision_intermediario_pct_default: string | null;
};

/** "1.500" (numeric de Postgres) → "1.5"; vacío si no tiene comisión. */
const mostrarPct = (v: string | null) => (v == null ? "" : String(Number(v)));

/**
 * Solapa Comisiones: el % que cobra cada cliente cuando actúa de
 * intermediario de flete. Es el mismo dato que el campo "Comisión de
 * intermediario por defecto" de la ficha, pero acá se cargan todos de un
 * vistazo. Al importar una CPE se precarga en el viaje (ver
 * construirValoresIniciales), donde sigue siendo editable.
 */
export function TablaComisiones({ filas }: { filas: FilaComision[] }) {
  const [busqueda, setBusqueda] = useState("");
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const digitos = q.replace(/[^0-9]/g, "");
    if (!q) return filas;
    return filas.filter(
      (f) =>
        f.razon_social.toLowerCase().includes(q) ||
        (digitos.length > 0 && (f.cuit ?? "").replace(/[^0-9]/g, "").includes(digitos))
    );
  }, [filas, busqueda]);
  const conComision = filas.filter((f) => f.comision_intermediario_pct_default != null).length;

  return (
    <div className="flex flex-col gap-6">
      <FormularioAgregar />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {conComision} de {filas.length} clientes con comisión cargada.
          </p>
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o CUIT..."
            className="w-full sm:w-72"
          />
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>CUIT</TableHead>
                <TableHead className="w-48">Comisión (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((f) => (
                // key con el valor guardado: tras guardar, la fila se
                // remonta con el % nuevo como valor inicial.
                <FilaEditable key={`${f.id}-${f.comision_intermediario_pct_default}`} fila={f} />
              ))}
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    No hay clientes que coincidan con la búsqueda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function FilaEditable({ fila }: { fila: FilaComision }) {
  const original = mostrarPct(fila.comision_intermediario_pct_default);
  const [valor, setValor] = useState(original);
  const [isPending, startTransition] = useTransition();
  const cambiado = valor.trim() !== original;

  function guardar() {
    if (!cambiado) return;
    startTransition(async () => {
      const r = await guardarComisionCliente(fila.id, valor);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        valor.trim() ? `Comisión de ${fila.razon_social}: ${valor.trim()}%.` : `Se quitó la comisión de ${fila.razon_social}.`
      );
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{fila.razon_social}</TableCell>
      <TableCell className="text-muted-foreground">{fila.cuit ?? "—"}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            inputMode="decimal"
            placeholder="Sin comisión"
            aria-label={`Comisión de ${fila.razon_social}`}
            className="w-28"
          />
          {cambiado && (
            <Button size="sm" onClick={guardar} disabled={isPending}>
              {isPending ? "..." : "Guardar"}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function FormularioAgregar() {
  const [isPending, startTransition] = useTransition();

  function agregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const datos = new FormData(formulario);
    const valores = {
      razon_social: String(datos.get("razon_social") ?? ""),
      cuit: String(datos.get("cuit") ?? ""),
      comision: String(datos.get("comision") ?? ""),
    };
    startTransition(async () => {
      const r = await crearClienteConComision(valores);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Cliente ${valores.razon_social.trim()} agregado.`);
      formulario.reset();
    });
  }

  return (
    <form onSubmit={agregar} className="flex flex-col gap-4 rounded-md border p-4">
      <div>
        <h3 className="text-sm font-bold">Agregar cliente</h3>
        <p className="text-sm text-muted-foreground">
          Al leer una CPE se busca el intermediario de flete por CUIT, así que cargalo tal cual
          figura en la carta de porte.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="comision-razon-social">Razón social</Label>
          <Input id="comision-razon-social" name="razon_social" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="comision-cuit">CUIT</Label>
          <Input id="comision-cuit" name="cuit" inputMode="numeric" placeholder="30-12345678-9" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="comision-pct">Comisión (%)</Label>
          <Input id="comision-pct" name="comision" inputMode="decimal" placeholder="Ej. 5" />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Agregando..." : "Agregar"}
        </Button>
      </div>
    </form>
  );
}
