"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eliminarAdjuntoViaje, subirAdjuntoManual } from "../../actions";

const etiquetasTipo: Record<string, string> = {
  cpe_pdf: "CPE (PDF)",
  ticket_balanza: "Ticket de balanza",
  remito: "Remito",
  factura: "Factura",
  comprobante: "Comprobante",
  otro: "Otro",
};

const opcionesTipo = Object.entries(etiquetasTipo).map(([value, label]) => ({ value, label }));

const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

type Fila = {
  id: number;
  tipo: string;
  nombre_archivo: string | null;
  storage_path: string;
  subido_en: Date;
  url: string | null;
};

export function TabAdjuntos({ viajeId, filas }: { viajeId: number; filas: Fila[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState("otro");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("tipo", tipo);
    startTransition(async () => {
      const resultado = await subirAdjuntoManual(viajeId, formData);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Adjunto subido.");
      setAbierto(false);
      router.refresh();
    });
  }

  function eliminar(id: number, storagePath: string) {
    startTransition(async () => {
      const resultado = await eliminarAdjuntoViaje(id, viajeId, storagePath);
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
        <Button onClick={() => setAbierto(true)}>Subir adjunto</Button>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin adjuntos cargados.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {f.nombre_archivo ?? "archivo"}
                    </a>
                  ) : (
                    <span className="font-medium">{f.nombre_archivo ?? "archivo"}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {etiquetasTipo[f.tipo] ?? f.tipo}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{formatoFecha.format(f.subido_en)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => eliminar(f.id, f.storage_path)}
                disabled={isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir adjunto</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="archivo-adjunto">Archivo</Label>
              <Input id="archivo-adjunto" name="archivo" type="file" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcionesTipo.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Subiendo..." : "Subir"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
