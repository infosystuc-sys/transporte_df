"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import {
  viajeAdicionalSchema,
  viajeTarifaSchema,
  type ViajeAdicionalInput,
  type ViajeTarifaInput,
} from "@/lib/schemas/viajes";
import { actualizarTarifa, crearAdicional, eliminarAdicional } from "../actions";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const opcionesModalidad = [
  { value: "por_tonelada", label: "Por tonelada" },
  { value: "por_km", label: "Por km" },
  { value: "por_tonelada_km", label: "Por tonelada-km" },
  { value: "monto_fijo", label: "Monto fijo" },
];
const opcionesBase = [
  { value: "origen", label: "Origen" },
  { value: "destino", label: "Destino" },
];
const opcionesACargo = [
  { value: "cliente", label: "Cliente" },
  { value: "empresa", label: "Empresa" },
];

type FilaAdicional = {
  id: number;
  tipo_adicional_id: number | null;
  descripcion: string | null;
  importe: string;
  a_cargo_de: "cliente" | "empresa" | null;
};

type Totales = {
  importe_flete: string | null;
  importe_adicionales: string | null;
  importe_comision: string | null;
  total_a_cobrar: string | null;
};

const valoresPorDefectoAdicional: ViajeAdicionalInput = {
  tipo_adicional_id: undefined as unknown as number,
  descripcion: "",
  importe: "",
  a_cargo_de: "cliente",
};

export function TabTarifa({
  viajeId,
  valoresIniciales,
  netoOrigen,
  netoDestino,
  totales,
  adicionales,
  tiposAdicional,
}: {
  viajeId: number;
  valoresIniciales: ViajeTarifaInput;
  netoOrigen: string | null;
  netoDestino: string | null;
  totales: Totales;
  adicionales: FilaAdicional[];
  tiposAdicional: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ViajeTarifaInput>({
    resolver: zodResolver(viajeTarifaSchema),
    defaultValues: valoresIniciales,
  });

  const [abiertoAdicional, setAbiertoAdicional] = useState(false);
  const [isPendingAdicional, startTransitionAdicional] = useTransition();
  const formAdicional = useForm<ViajeAdicionalInput>({
    resolver: zodResolver(viajeAdicionalSchema),
    defaultValues: valoresPorDefectoAdicional,
  });

  const baseCalculo = valoresIniciales.base_calculo ?? "destino";
  const netoBaseCargado = baseCalculo === "origen" ? netoOrigen : netoDestino;
  const netoOtroCargado = baseCalculo === "origen" ? netoDestino : netoOrigen;
  const usaElOtroNeto = !netoBaseCargado && !!netoOtroCargado;

  function onSubmit(valores: ViajeTarifaInput) {
    startTransition(async () => {
      const resultado = await actualizarTarifa(viajeId, valores);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Guardado.");
      router.refresh();
    });
  }

  function onSubmitAdicional(valores: ViajeAdicionalInput) {
    startTransitionAdicional(async () => {
      const resultado = await crearAdicional(viajeId, valores);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Agregado.");
      formAdicional.reset(valoresPorDefectoAdicional);
      setAbiertoAdicional(false);
      router.refresh();
    });
  }

  function eliminar(id: number) {
    startTransitionAdicional(async () => {
      const resultado = await eliminarAdicional(id, viajeId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  const nombreTipo = (id: number | null) => tiposAdicional.find((t) => t.id === id)?.nombre ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoSelect form={form} name="modalidad_tarifa" label="Modalidad" opciones={opcionesModalidad} />
          <CampoTexto form={form} name="valor_tarifa" label="Valor de la tarifa ($)" />
          <CampoSelect form={form} name="base_calculo" label="Base de cálculo" opciones={opcionesBase} />
        </div>
        {usaElOtroNeto && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Todavía no se cargó el neto de {baseCalculo}, así que el cálculo usa el otro neto
            disponible.
          </p>
        )}
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Importe del flete</p>
          <p>{totales.importe_flete ? formatoARS.format(Number(totales.importe_flete)) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Adicionales (cliente)</p>
          <p>{totales.importe_adicionales ? formatoARS.format(Number(totales.importe_adicionales)) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Comisión</p>
          <p>{totales.importe_comision ? formatoARS.format(Number(totales.importe_comision)) : "—"}</p>
        </div>
        <div>
          <p className="font-medium text-muted-foreground">Total a cobrar</p>
          <p className="font-medium">
            {totales.total_a_cobrar ? formatoARS.format(Number(totales.total_a_cobrar)) : "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Adicionales</h3>
          <Button size="sm" onClick={() => setAbiertoAdicional(true)}>
            Agregar adicional
          </Button>
        </div>

        {adicionales.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin adicionales cargados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {adicionales.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{nombreTipo(a.tipo_adicional_id)}</span>
                    <Badge variant={a.a_cargo_de === "empresa" ? "secondary" : "outline"}>
                      {a.a_cargo_de === "empresa" ? "Empresa" : "Cliente"}
                    </Badge>
                  </div>
                  {a.descripcion && <p className="text-sm text-muted-foreground">{a.descripcion}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span>{formatoARS.format(Number(a.importe))}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => eliminar(a.id)}
                    disabled={isPendingAdicional}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={abiertoAdicional} onOpenChange={setAbiertoAdicional}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo adicional</DialogTitle>
          </DialogHeader>
          <form onSubmit={formAdicional.handleSubmit(onSubmitAdicional)} className="flex flex-col gap-4">
            <CampoSelect
              form={formAdicional}
              name="tipo_adicional_id"
              label="Tipo"
              opciones={tiposAdicional.map((t) => ({ value: String(t.id), label: t.nombre }))}
            />
            <CampoTexto form={formAdicional} name="descripcion" label="Descripción" />
            <CampoTexto form={formAdicional} name="importe" label="Importe ($)" />
            <CampoSelect
              form={formAdicional}
              name="a_cargo_de"
              label="A cargo de"
              opciones={opcionesACargo}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPendingAdicional}>
                {isPendingAdicional ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
