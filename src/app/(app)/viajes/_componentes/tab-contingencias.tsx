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
import { CampoBooleano, CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { viajeContingenciaSchema, type ViajeContingenciaInput } from "@/lib/schemas/viajes";
import { crearContingencia, eliminarContingencia } from "../actions";

type Fila = {
  id: number;
  tipo_contingencia_id: number | null;
  descripcion: string | null;
  fecha: Date | null;
  es_desactivacion: boolean;
};

const valoresPorDefecto: ViajeContingenciaInput = {
  tipo_contingencia_id: undefined,
  descripcion: "",
  fecha: undefined,
  es_desactivacion: false,
};

export function TabContingencias({
  viajeId,
  filas,
  tiposContingencia,
}: {
  viajeId: number;
  filas: Fila[];
  tiposContingencia: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<ViajeContingenciaInput>({
    resolver: zodResolver(viajeContingenciaSchema),
    defaultValues: valoresPorDefecto,
  });

  const nombreTipo = (id: number | null) =>
    tiposContingencia.find((t) => t.id === id)?.nombre ?? "—";

  function onSubmit(valores: ViajeContingenciaInput) {
    startTransition(async () => {
      const resultado = await crearContingencia(viajeId, valores);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Agregada.");
      form.reset(valoresPorDefecto);
      setAbierto(false);
      router.refresh();
    });
  }

  function eliminar(id: number) {
    startTransition(async () => {
      const resultado = await eliminarContingencia(id, viajeId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setAbierto(true)}>Agregar contingencia</Button>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin contingencias registradas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{nombreTipo(f.tipo_contingencia_id)}</span>
                  {f.es_desactivacion && <Badge variant="secondary">Desactivación</Badge>}
                </div>
                {f.descripcion && <p className="text-sm text-muted-foreground">{f.descripcion}</p>}
                {f.fecha && (
                  <p className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("es-AR", {
                      timeZone: "America/Argentina/Cordoba",
                    }).format(f.fecha)}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => eliminar(f.id)} disabled={isPending}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva contingencia</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <CampoSelect
              form={form}
              name="tipo_contingencia_id"
              label="Tipo"
              opciones={tiposContingencia.map((t) => ({ value: String(t.id), label: t.nombre }))}
            />
            <CampoTexto form={form} name="descripcion" label="Descripción" textarea />
            <CampoTexto form={form} name="fecha" label="Fecha" tipo="date" />
            <CampoBooleano form={form} name="es_desactivacion" label="Es una desactivación" />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
