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
import { BotonCargarIA } from "@/lib/comprobantes/boton-cargar-ia";
import { formatoFechaInput } from "@/lib/schemas/campos-fecha";
import { viajeGastoSchema, type ViajeGastoInput } from "@/lib/schemas/viajes";
import { crearGasto, crearGastoConAdjunto, eliminarGasto } from "../actions";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

type FilaGasto = {
  id: number;
  tipo_gasto_id: number | null;
  fecha: Date | null;
  importe: string;
  pagado_por: "empresa" | "chofer" | null;
  comprobante_nro: string | null;
  rendido: boolean | null;
  observaciones: string | null;
};

type FilaGasoil = {
  id: number;
  fecha: Date;
  litros: string;
  importe: string;
  modalidad: "cuenta_corriente" | "pagado_por_chofer" | "surtidor_propio";
};

const opcionesPagadoPor = [
  { value: "empresa", label: "Empresa" },
  { value: "chofer", label: "Chofer" },
];

const valoresPorDefecto: ViajeGastoInput = {
  tipo_gasto_id: undefined as unknown as number,
  fecha: undefined,
  importe: "",
  pagado_por: "empresa",
  medio_pago_id: undefined,
  comprobante_nro: "",
  rendido: false,
  observaciones: "",
};

export function TabGastos({
  viajeId,
  gastos,
  gasoil,
  tiposGasto,
  medioPagos,
}: {
  viajeId: number;
  gastos: FilaGasto[];
  gasoil: FilaGasoil[];
  tiposGasto: { id: number; nombre: string }[];
  medioPagos: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [archivoIA, setArchivoIA] = useState<File | null>(null);
  const form = useForm<ViajeGastoInput>({
    resolver: zodResolver(viajeGastoSchema),
    defaultValues: valoresPorDefecto,
  });

  const nombreTipo = (id: number | null) => tiposGasto.find((t) => t.id === id)?.nombre ?? "—";
  const totalGastos = gastos.reduce((s, g) => s + Number(g.importe), 0);
  const totalGasoil = gasoil.reduce((s, g) => s + Number(g.importe), 0);

  function onSubmit(valores: ViajeGastoInput) {
    startTransition(async () => {
      let resultado;
      if (archivoIA) {
        const formData = new FormData();
        formData.set("archivo", archivoIA);
        formData.set("datos", JSON.stringify(valores));
        resultado = await crearGastoConAdjunto(viajeId, formData);
      } else {
        resultado = await crearGasto(viajeId, valores);
      }
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Agregado.");
      form.reset(valoresPorDefecto);
      setArchivoIA(null);
      setAbierto(false);
      router.refresh();
    });
  }

  function eliminar(id: number) {
    startTransition(async () => {
      const resultado = await eliminarGasto(id, viajeId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Gastos del viaje {gastos.length > 0 && `— ${formatoARS.format(totalGastos)}`}
          </h3>
          <Button
            size="sm"
            onClick={() => {
              setArchivoIA(null);
              setAbierto(true);
            }}
          >
            Agregar gasto
          </Button>
        </div>

        {gastos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin gastos cargados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {gastos.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{nombreTipo(g.tipo_gasto_id)}</span>
                    {g.pagado_por === "chofer" && (
                      <Badge variant={g.rendido ? "secondary" : "outline"}>
                        Chofer {g.rendido ? "(rendido)" : "(pendiente de rendir)"}
                      </Badge>
                    )}
                  </div>
                  {g.observaciones && <p className="text-sm text-muted-foreground">{g.observaciones}</p>}
                  {g.fecha && <p className="text-xs text-muted-foreground">{formatoFecha.format(g.fecha)}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span>{formatoARS.format(Number(g.importe))}</span>
                  <Button variant="ghost" size="icon" onClick={() => eliminar(g.id)} disabled={isPending}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Gasoil imputado a este viaje {gasoil.length > 0 && `— ${formatoARS.format(totalGasoil)}`}
        </h3>
        {gasoil.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin cargas de gasoil vinculadas. Se cargan desde la pantalla de Gasoil, eligiendo este
            viaje.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {gasoil.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-md border p-3">
                <span>
                  {formatoFecha.format(g.fecha)} — {g.litros} L
                </span>
                <span>{formatoARS.format(Number(g.importe))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo gasto</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <BotonCargarIA
                onExtraido={(archivo, datos) => {
                  setArchivoIA(archivo);
                  form.reset({
                    ...form.getValues(),
                    fecha: (datos.fecha
                      ? (formatoFechaInput(datos.fecha) as unknown as Date)
                      : form.getValues("fecha")) as Date | undefined,
                    importe:
                      datos.importe_total != null
                        ? String(datos.importe_total)
                        : form.getValues("importe"),
                    comprobante_nro: datos.comprobante_nro ?? form.getValues("comprobante_nro"),
                  });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Precarga importe, fecha y N° de comprobante. Tipo y medio de pago siempre se
                completan a mano.
              </p>
            </div>
            <CampoSelect
              form={form}
              name="tipo_gasto_id"
              label="Tipo"
              opciones={tiposGasto.map((t) => ({ value: String(t.id), label: t.nombre }))}
            />
            <CampoTexto form={form} name="fecha" label="Fecha" tipo="date" />
            <CampoTexto form={form} name="importe" label="Importe ($)" />
            <CampoSelect form={form} name="pagado_por" label="Pagado por" opciones={opcionesPagadoPor} />
            <CampoSelect
              form={form}
              name="medio_pago_id"
              label="Medio de pago"
              opciones={medioPagos.map((m) => ({ value: String(m.id), label: m.nombre }))}
            />
            <CampoTexto form={form} name="comprobante_nro" label="N° de comprobante" />
            <CampoBooleano form={form} name="rendido" label="Ya rendido (si lo pagó el chofer)" />
            <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />
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
