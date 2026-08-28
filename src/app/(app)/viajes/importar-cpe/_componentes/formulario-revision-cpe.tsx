"use client";

import { useMemo, useEffect, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { viajeDesdeCpeSchema, type ViajeDesdeCpeInput } from "@/lib/schemas/cpe-importacion";
import type { BaseCalculo, ModalidadTarifa } from "@/lib/tarifa-defaults";
import type { ResultadoImportacionCpe } from "@/lib/cpe/importar";
import type { EntidadFaltante, TipoEntidadFaltante } from "@/lib/cpe/matching";
import {
  agruparFaltantes,
  calcularHuellaFaltante,
  construirValoresIniciales,
  CamposRevisionCpe,
  DialogCrearRapido,
  type Opcion,
  type TipoEntidad,
} from "./campos-revision-cpe";
import { confirmarImportacionCpe, crearEntidadesFaltantes, importarCpe } from "../actions";

export function FormularioRevisionCpe({
  clientes,
  camiones,
  choferes,
  productos,
  lugares,
  configDefaults,
}: {
  clientes: {
    id: number;
    nombre: string;
    cuit: string | null;
    base_calculo_flete: BaseCalculo | "heredar" | null;
  }[];
  camiones: { id: number; dominio_tractor: string; dominio_acoplado: string | null }[];
  choferes: { id: number; nombre: string; cuil: string | null }[];
  productos: { id: number; nombre: string }[];
  lugares: { id: number; nombre: string }[];
  configDefaults: {
    base_calculo_flete_default: BaseCalculo | null;
    modalidad_tarifa_default: ModalidadTarifa | null;
  };
}) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const urlPreview = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo]);
  const [resultado, setResultado] = useState<ResultadoImportacionCpe | null>(null);
  const [isPendingProcesar, startTransitionProcesar] = useTransition();
  const [isPendingConfirmar, startTransitionConfirmar] = useTransition();

  const [opcionesClientes, setOpcionesClientes] = useState<Opcion[]>(() =>
    clientes.map((c) => ({ value: String(c.id), label: c.nombre }))
  );
  const [opcionesCamiones, setOpcionesCamiones] = useState<Opcion[]>(() =>
    camiones.map((c) => ({ value: String(c.id), label: c.dominio_tractor }))
  );
  const [opcionesChoferes, setOpcionesChoferes] = useState<Opcion[]>(() =>
    choferes.map((c) => ({ value: String(c.id), label: c.nombre }))
  );
  const [opcionesLugares, setOpcionesLugares] = useState<Opcion[]>(() =>
    lugares.map((l) => ({ value: String(l.id), label: l.nombre }))
  );
  const [opcionesProductos, setOpcionesProductos] = useState<Opcion[]>(() =>
    productos.map((p) => ({ value: String(p.id), label: p.nombre }))
  );

  // Se guardan aparte de `resultado` porque se vacían al darlos de alta.
  const [faltantes, setFaltantes] = useState<EntidadFaltante[]>([]);
  const [isPendingFaltantes, startTransitionFaltantes] = useTransition();
  const grupos = useMemo(() => agruparFaltantes(faltantes), [faltantes]);

  const [dialog, setDialog] = useState<{
    tipo: TipoEntidad;
    titulo: string;
    nombre: string;
    extra: string;
    campo: Path<ViajeDesdeCpeInput>;
  } | null>(null);

  const form = useForm<ViajeDesdeCpeInput>({
    resolver: zodResolver(viajeDesdeCpeSchema),
  });

  // Solo libera el objeto URL anterior — el valor en sí se computa en
  // render vía useMemo, no acá (evita setState sincrónico en un efecto).
  useEffect(() => {
    return () => {
      if (urlPreview) URL.revokeObjectURL(urlPreview);
    };
  }, [urlPreview]);

  function onSeleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setArchivo(f);
    setResultado(null);
    setFaltantes([]);
  }

  function procesar() {
    if (!archivo) return;
    startTransitionProcesar(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      try {
        const r = await importarCpe(formData);
        setResultado(r);
        setFaltantes(r.faltantes);
        form.reset(construirValoresIniciales(r, clientes, configDefaults));
      } catch (err) {
        console.error("importarCpe falló:", err);
        const mensaje = err instanceof Error ? err.message : String(err);
        toast.error(`No se pudo procesar el PDF: ${mensaje}`);
      }
    });
  }

  function agregarOpcion(tipo: TipoEntidadFaltante, id: number, nombre: string) {
    const opcion = { value: String(id), label: nombre };
    const sumar = (prev: Opcion[]) =>
      prev.some((o) => o.value === opcion.value) ? prev : [...prev, opcion];
    if (tipo === "cliente") setOpcionesClientes(sumar);
    if (tipo === "camion") setOpcionesCamiones(sumar);
    if (tipo === "chofer") setOpcionesChoferes(sumar);
    if (tipo === "lugar") setOpcionesLugares(sumar);
    if (tipo === "producto") setOpcionesProductos(sumar);
  }

  /** Da de alta todo lo faltante y deja los campos del viaje ya apuntando a lo nuevo. */
  function darDeAltaFaltantes() {
    startTransitionFaltantes(async () => {
      const r = await crearEntidadesFaltantes({ faltantes });
      if (r.error || !r.creadas) {
        toast.error(r.error ?? "No se pudieron dar de alta los registros.");
        return;
      }
      const creadas = r.creadas;

      for (const f of faltantes) {
        const id = creadas[f.clave];
        if (id == null) continue;
        form.setValue(f.campo as Path<ViajeDesdeCpeInput>, id as never);
      }
      for (const g of grupos) {
        const clave = faltantes.find((f) => calcularHuellaFaltante(f) === g.huella)?.clave;
        const id = clave ? creadas[clave] : undefined;
        if (id != null) agregarOpcion(g.tipo, id, g.nombre);
      }

      toast.success(
        grupos.length === 1 ? "Se dio de alta 1 registro." : `Se dieron de alta ${grupos.length} registros.`
      );
      setFaltantes([]);
    });
  }

  function confirmar(valores: ViajeDesdeCpeInput) {
    if (!archivo) return;
    startTransitionConfirmar(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      formData.set("datos", JSON.stringify(valores));
      try {
        const r = await confirmarImportacionCpe(formData);
        if (r?.error) {
          toast.error(r.error);
          return;
        }
        router.refresh();
      } catch (err) {
        // Deja pasar el redirect() de éxito de confirmarImportacionCpe: es
        // una excepción de control de flujo interna de Next, no un error.
        unstable_rethrow(err);
        console.error("confirmarImportacionCpe falló:", err);
        const mensaje = err instanceof Error ? err.message : String(err);
        toast.error(`No se pudo crear el viaje: ${mensaje}`);
      }
    });
  }

  function abrirCrear(tipo: TipoEntidad, titulo: string, nombre: string, extra: string, campo: Path<ViajeDesdeCpeInput>) {
    setDialog({ tipo, titulo, nombre, extra, campo });
  }

  function onCreado(id: number, nombre: string) {
    if (!dialog) return;
    form.setValue(dialog.campo, id as never);
    agregarOpcion(dialog.tipo, id, nombre);
    setFaltantes((prev) => prev.filter((f) => f.campo !== dialog.campo));
  }

  return (
    <div className="flex flex-col gap-6">
      {!resultado && (
        <div className="flex flex-col gap-4 rounded-md border p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="archivo-cpe">Archivo o foto de la CPE</Label>
            <Input
              id="archivo-cpe"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
              onChange={onSeleccionarArchivo}
            />
          </div>
          <div>
            <Button onClick={procesar} disabled={!archivo || isPendingProcesar}>
              {isPendingProcesar ? "Procesando..." : "Procesar CPE"}
            </Button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={form.handleSubmit(confirmar)} className="flex flex-col gap-6">
            <CamposRevisionCpe
              form={form}
              resultado={resultado}
              grupos={grupos}
              isPendingFaltantes={isPendingFaltantes}
              onDarDeAltaFaltantes={darDeAltaFaltantes}
              onDescartarFaltantes={() => setFaltantes([])}
              opcionesClientes={opcionesClientes}
              opcionesCamiones={opcionesCamiones}
              opcionesChoferes={opcionesChoferes}
              opcionesProductos={opcionesProductos}
              opcionesLugares={opcionesLugares}
              onAbrirCrear={abrirCrear}
            />

            <div className="flex gap-3">
              <Button type="submit" disabled={isPendingConfirmar}>
                {isPendingConfirmar ? "Creando viaje..." : "Confirmar y crear viaje"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setResultado(null);
                  setArchivo(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>

          <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
            {urlPreview && (
              <iframe src={urlPreview} title="Vista previa de la CPE" className="h-full min-h-[600px] w-full rounded-md border" />
            )}
          </div>
        </div>
      )}

      <DialogCrearRapido dialog={dialog} onOpenChange={(v) => !v && setDialog(null)} onCreado={onCreado} />
    </div>
  );
}
