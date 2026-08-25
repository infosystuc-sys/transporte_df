"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  confirmarImportacionHistorica,
  previsualizarExcelHistorico,
  type FilaHistoricaConCoincidencias,
  type HojaHistoricaProcesada,
} from "../actions";

type Opcion = { id: number; nombre: string };

const opcionesEstado = [
  { value: "planificado", label: "Planificado" },
  { value: "cargado", label: "Cargado" },
  { value: "en_transito", label: "En tránsito" },
  { value: "descargado", label: "Descargado" },
  { value: "facturado", label: "Facturado" },
  { value: "cobrado", label: "Cobrado" },
  { value: "liquidado", label: "Liquidado" },
] as const;

type FilaEditable = FilaHistoricaConCoincidencias & {
  incluir: boolean;
  cliente_id: number | undefined;
  producto_id: number | undefined;
  camion_id: number | undefined;
  chofer_id: number | undefined;
  estado: (typeof opcionesEstado)[number]["value"];
};

type HojaEditable = { hoja: string; filas: FilaEditable[] };

function SelectOpcional({
  value,
  onChange,
  opciones,
  placeholder,
  destacarVacio,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  opciones: Opcion[];
  placeholder: string;
  destacarVacio?: boolean;
}) {
  return (
    <Select
      value={value != null ? String(value) : undefined}
      onValueChange={(v) => onChange(v ? Number(v) : undefined)}
    >
      <SelectTrigger className={`w-full ${destacarVacio && value == null ? "border-destructive" : ""}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FormularioImportacionHistorica({
  clientes,
  camiones,
  choferes,
  productos,
  lugares,
}: {
  clientes: Opcion[];
  camiones: Opcion[];
  choferes: Opcion[];
  productos: Opcion[];
  lugares: Opcion[];
}) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hojas, setHojas] = useState<HojaEditable[] | null>(null);
  const [isPendingProcesar, startTransitionProcesar] = useTransition();
  const [isPendingConfirmar, startTransitionConfirmar] = useTransition();

  function procesar() {
    if (!archivo) return;
    startTransitionProcesar(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      try {
        const resultado = await previsualizarExcelHistorico(formData);
        if (resultado.length === 0) {
          toast.error("No se encontraron filas reconocibles en el archivo.");
          return;
        }
        setHojas(
          resultado.map((h: HojaHistoricaProcesada) => ({
            hoja: h.hoja,
            filas: h.filas.map((f) => ({
              ...f,
              incluir: true,
              cliente_id: undefined,
              producto_id: h.productoIdSugerido ?? undefined,
              camion_id: undefined,
              chofer_id: undefined,
              estado: "descargado" as const,
            })),
          }))
        );
        const totalFilas = resultado.reduce((s, h) => s + h.filas.length, 0);
        const totalOmitidas = resultado.reduce((s, h) => s + h.filasOmitidas, 0);
        toast.success(
          `${totalFilas} fila(s) reconocidas${totalOmitidas > 0 ? ` (${totalOmitidas} fila(s) de subtotal ignoradas)` : ""}.`
        );
      } catch {
        toast.error("No se pudo leer el archivo. Verificá que sea un .xlsx válido.");
      }
    });
  }

  function actualizarFila(hojaIdx: number, filaIdx: number, cambios: Partial<FilaEditable>) {
    setHojas((prev) => {
      if (!prev) return prev;
      const copia = [...prev];
      const filas = [...copia[hojaIdx].filas];
      filas[filaIdx] = { ...filas[filaIdx], ...cambios };
      copia[hojaIdx] = { ...copia[hojaIdx], filas };
      return copia;
    });
  }

  function asignarATodos(hojaIdx: number, cambios: Partial<FilaEditable>) {
    setHojas((prev) => {
      if (!prev) return prev;
      const copia = [...prev];
      copia[hojaIdx] = {
        ...copia[hojaIdx],
        filas: copia[hojaIdx].filas.map((f) => (f.incluir ? { ...f, ...cambios } : f)),
      };
      return copia;
    });
  }

  function confirmar() {
    if (!hojas) return;
    const filas = hojas
      .flatMap((h) => h.filas)
      .filter((f) => f.incluir)
      .map((f) => ({
        fecha_carga: f.fecha_carga,
        ctg: f.ctg,
        cliente_id: f.cliente_id as unknown as number,
        producto_id: f.producto_id,
        origen_id: f.origen_id ?? undefined,
        destino_id: f.destino_id ?? undefined,
        camion_id: f.camion_id,
        chofer_id: f.chofer_id,
        valor_tarifa: f.valor_tarifa ?? undefined,
        tn_origen: f.tn_origen ?? undefined,
        tn_destino: f.tn_destino ?? undefined,
        importe_liquidacion_chofer: f.chofer_15pct ?? undefined,
        estado: f.estado,
      }));

    if (filas.some((f) => !f.cliente_id)) {
      toast.error("Todas las filas incluidas necesitan un cliente asignado.");
      return;
    }

    startTransitionConfirmar(async () => {
      const resultado = await confirmarImportacionHistorica({ filas });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`${filas.length} viaje(s) importado(s).`);
      router.push("/viajes?importado_de_excel=1");
    });
  }

  const opcionesLugares: Opcion[] = lugares;

  return (
    <div className="flex flex-col gap-6">
      {!hojas && (
        <div className="flex flex-col gap-4 rounded-md border p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="archivo-historico">Archivo .xlsx</Label>
            <Input
              id="archivo-historico"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Button onClick={procesar} disabled={!archivo || isPendingProcesar}>
              {isPendingProcesar ? "Procesando..." : "Procesar archivo"}
            </Button>
          </div>
        </div>
      )}

      {hojas && (
        <>
          <Tabs defaultValue={hojas[0]?.hoja}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {hojas.map((h) => (
                <TabsTrigger key={h.hoja} value={h.hoja}>
                  {h.hoja} ({h.filas.length})
                </TabsTrigger>
              ))}
            </TabsList>

            {hojas.map((h, hojaIdx) => (
              <TabsContent key={h.hoja} value={h.hoja} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
                  <div className="flex flex-col gap-2">
                    <Label>Asignar cliente a todos</Label>
                    <SelectOpcional
                      value={undefined}
                      onChange={(v) => asignarATodos(hojaIdx, { cliente_id: v })}
                      opciones={clientes}
                      placeholder="Elegir cliente..."
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Asignar producto a todos</Label>
                    <SelectOpcional
                      value={undefined}
                      onChange={(v) => asignarATodos(hojaIdx, { producto_id: v })}
                      opciones={productos}
                      placeholder="Elegir producto..."
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Asignar chofer a todos (opcional)</Label>
                    <SelectOpcional
                      value={undefined}
                      onChange={(v) => asignarATodos(hojaIdx, { chofer_id: v })}
                      opciones={choferes}
                      placeholder="Elegir chofer..."
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Asignar camión a todos (opcional)</Label>
                    <SelectOpcional
                      value={undefined}
                      onChange={(v) => asignarATodos(hojaIdx, { camion_id: v })}
                      opciones={camiones}
                      placeholder="Elegir camión..."
                    />
                  </div>
                </div>

                <div className="max-h-[60vh] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>Fila</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>CTG</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Tarifa</TableHead>
                        <TableHead>TN destino</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {h.filas.map((f, filaIdx) => (
                        <TableRow key={f.filaExcel} className={!f.incluir ? "opacity-50" : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={f.incluir}
                              onCheckedChange={(v) => actualizarFila(hojaIdx, filaIdx, { incluir: !!v })}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{f.filaExcel}</TableCell>
                          <TableCell>{f.fecha_carga ?? "—"}</TableCell>
                          <TableCell>{f.ctg ?? "—"}</TableCell>
                          <TableCell className="min-w-40">
                            <SelectOpcional
                              value={f.cliente_id}
                              onChange={(v) => actualizarFila(hojaIdx, filaIdx, { cliente_id: v })}
                              opciones={clientes}
                              placeholder="Cliente..."
                              destacarVacio
                            />
                          </TableCell>
                          <TableCell className="min-w-40">
                            <SelectOpcional
                              value={f.origen_id ?? undefined}
                              onChange={(v) => actualizarFila(hojaIdx, filaIdx, { origen_id: v ?? null })}
                              opciones={opcionesLugares}
                              placeholder={f.origen_nombre ?? "Origen..."}
                            />
                          </TableCell>
                          <TableCell className="min-w-40">
                            <SelectOpcional
                              value={f.destino_id ?? undefined}
                              onChange={(v) => actualizarFila(hojaIdx, filaIdx, { destino_id: v ?? null })}
                              opciones={opcionesLugares}
                              placeholder={f.destino_nombre ?? "Destino..."}
                            />
                          </TableCell>
                          <TableCell className="min-w-40">
                            <SelectOpcional
                              value={f.producto_id}
                              onChange={(v) => actualizarFila(hojaIdx, filaIdx, { producto_id: v })}
                              opciones={productos}
                              placeholder="Producto..."
                            />
                          </TableCell>
                          <TableCell>{f.valor_tarifa ?? "—"}</TableCell>
                          <TableCell>{f.tn_destino ?? "—"}</TableCell>
                          <TableCell className="min-w-36">
                            <Select
                              value={f.estado}
                              onValueChange={(v) =>
                                actualizarFila(hojaIdx, filaIdx, {
                                  estado: v as FilaEditable["estado"],
                                })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {opcionesEstado.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex gap-3">
            <Button onClick={confirmar} disabled={isPendingConfirmar}>
              {isPendingConfirmar ? "Importando..." : "Confirmar importación"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setHojas(null)}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
