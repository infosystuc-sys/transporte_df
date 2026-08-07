"use client";

import { useMemo, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CampoBooleano, CampoTexto } from "@/components/catalogos/campos-formulario";
import { viajeDesdeCpeSchema, type ViajeDesdeCpeInput } from "@/lib/schemas/cpe-importacion";
import type { ResultadoImportacionCpe } from "@/lib/cpe/importar";
import {
  confirmarImportacionCpe,
  crearCamionRapido,
  crearChoferRapido,
  crearClienteRapido,
  crearLugarRapido,
  importarCpe,
} from "../actions";

type Opcion = { value: string; label: string };
type TipoEntidad = "cliente" | "camion" | "chofer" | "lugar";

const opcionesDeclaracion = [
  { value: "conforme", label: "Conforme" },
  { value: "condicional", label: "Condicional" },
];
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

const soloFecha = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const numStr = (n: number | null) => (n == null ? "" : String(n));

function construirValoresIniciales(resultado: ResultadoImportacionCpe): ViajeDesdeCpeInput {
  const { extraido: e, coincidencias: c } = resultado;
  return {
    tiene_cpe: true,
    tipo_carga: "grano",
    cpe_nro: e.cpe_nro ?? "",
    ctg: e.ctg ?? "",
    cpe_fecha_emision: soloFecha(e.cpe_fecha_emision) as unknown as Date | undefined,
    ctg_vencimiento: soloFecha(e.ctg_vencimiento) as unknown as Date | undefined,
    campania: e.campania ?? "",
    declaracion_calidad: e.declaracion_calidad,
    remito_nro: "",

    cliente_id: (c.titular_id ?? undefined) as unknown as number,
    pagador_id: c.pagador_id ?? undefined,
    destinatario_id: c.destinatario_id ?? undefined,
    intermediario_id: undefined,
    comision_intermediario_pct: undefined,

    camion_id: c.camion_id ?? undefined,
    chofer_id: c.chofer_id ?? undefined,
    dominio_tractor: e.dominio_tractor ?? "",
    dominio_acoplado: e.dominio_acoplado ?? "",
    producto_id: c.producto_id ?? undefined,
    origen_id: c.origen_id ?? undefined,
    destino_id: c.destino_id ?? undefined,
    km: e.km ?? undefined,

    observaciones: "",

    fecha_carga: undefined,
    fecha_partida: soloFecha(e.fecha_partida) as unknown as Date | undefined,
    bruto_origen: numStr(e.bruto_origen_kg),
    tara_origen: numStr(e.tara_origen_kg),
    neto_origen: numStr(e.neto_origen_kg),

    fecha_arribo: soloFecha(e.fecha_arribo) as unknown as Date | undefined,
    fecha_descarga: soloFecha(e.fecha_descarga) as unknown as Date | undefined,
    n_turno_descarga: e.n_turno_descarga ?? "",
    bruto_destino: numStr(e.bruto_destino_kg),
    tara_destino: numStr(e.tara_destino_kg),
    neto_destino: numStr(e.neto_destino_kg),
    merma_precio_unitario: undefined,

    modalidad_tarifa: undefined,
    valor_tarifa: numStr(e.valor_tarifa),
    base_calculo: undefined,
  };
}

function CampoEntidadConCrear({
  form,
  name,
  label,
  opciones,
  onAbrirCrear,
}: {
  form: ReturnType<typeof useForm<ViajeDesdeCpeInput>>;
  name: Path<ViajeDesdeCpeInput>;
  label: string;
  opciones: Opcion[];
  onAbrirCrear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={onAbrirCrear}
          className="text-xs text-primary hover:underline"
        >
          + Nuevo
        </button>
      </div>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value != null ? String(field.value) : undefined}
            onValueChange={field.onChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {opciones.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

function DialogCrearRapido({
  dialog,
  onOpenChange,
  onCreado,
}: {
  dialog: { tipo: TipoEntidad; titulo: string; nombre: string; extra: string } | null;
  onOpenChange: (v: boolean) => void;
  onCreado: (id: number, nombre: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const etiquetaExtra =
    dialog?.tipo === "cliente" ? "CUIT" : dialog?.tipo === "chofer" ? "CUIL" : null;

  function confirmar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dialog) return;
    const formData = new FormData(e.currentTarget);
    const nombre = String(formData.get("nombre") ?? "").trim();
    const extra = String(formData.get("extra") ?? "").trim();
    if (!nombre) {
      toast.error("Ingresá un nombre.");
      return;
    }
    startTransition(async () => {
      let resultado: { id: number };
      switch (dialog.tipo) {
        case "cliente":
          resultado = await crearClienteRapido({ razon_social: nombre, cuit: extra });
          break;
        case "camion":
          resultado = await crearCamionRapido({ dominio_tractor: nombre });
          break;
        case "chofer":
          resultado = await crearChoferRapido({ nombre_completo: nombre, cuil: extra });
          break;
        case "lugar":
          resultado = await crearLugarRapido({ nombre });
          break;
      }
      toast.success("Creado.");
      onCreado(resultado.id, nombre);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={dialog != null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog?.titulo}</DialogTitle>
        </DialogHeader>
        {/* key fuerza que el form se remonte con los valores del nuevo diálogo (inputs no controlados). */}
        <form key={dialog ? `${dialog.tipo}-${dialog.nombre}-${dialog.extra}` : "cerrado"} onSubmit={confirmar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Nombre</Label>
            <Input name="nombre" defaultValue={dialog?.nombre ?? ""} />
          </div>
          {etiquetaExtra && (
            <div className="flex flex-col gap-2">
              <Label>{etiquetaExtra}</Label>
              <Input name="extra" defaultValue={dialog?.extra ?? ""} />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FormularioRevisionCpe({
  clientes,
  camiones,
  choferes,
  productos,
  lugares,
}: {
  clientes: { id: number; nombre: string; cuit: string | null }[];
  camiones: { id: number; dominio_tractor: string; dominio_acoplado: string | null }[];
  choferes: { id: number; nombre: string; cuil: string | null }[];
  productos: { id: number; nombre: string }[];
  lugares: { id: number; nombre: string }[];
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
  const opcionesProductos = productos.map((p) => ({ value: String(p.id), label: p.nombre }));

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
  }

  function procesar() {
    if (!archivo) return;
    startTransitionProcesar(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      try {
        const r = await importarCpe(formData);
        setResultado(r);
        form.reset(construirValoresIniciales(r));
      } catch {
        toast.error("No se pudo procesar el PDF. Verificá que sea un archivo válido.");
      }
    });
  }

  function confirmar(valores: ViajeDesdeCpeInput) {
    if (!archivo) return;
    startTransitionConfirmar(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      formData.set("datos", JSON.stringify(valores));
      const r = await confirmarImportacionCpe(formData);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  function abrirCrear(tipo: TipoEntidad, titulo: string, nombre: string, extra: string, campo: Path<ViajeDesdeCpeInput>) {
    setDialog({ tipo, titulo, nombre, extra, campo });
  }

  function onCreado(id: number, nombre: string) {
    if (!dialog) return;
    form.setValue(dialog.campo, id as never);
    const opcion = { value: String(id), label: nombre };
    if (dialog.tipo === "cliente") setOpcionesClientes((prev) => [...prev, opcion]);
    if (dialog.tipo === "camion") setOpcionesCamiones((prev) => [...prev, opcion]);
    if (dialog.tipo === "chofer") setOpcionesChoferes((prev) => [...prev, opcion]);
    if (dialog.tipo === "lugar") setOpcionesLugares((prev) => [...prev, opcion]);
  }

  const e = resultado?.extraido;

  return (
    <div className="flex flex-col gap-6">
      {!resultado && (
        <div className="flex flex-col gap-4 rounded-md border p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="archivo-cpe">Archivo PDF de la CPE</Label>
            <Input id="archivo-cpe" type="file" accept="application/pdf" onChange={onSeleccionarArchivo} />
          </div>
          <div>
            <Button onClick={procesar} disabled={!archivo || isPendingProcesar}>
              {isPendingProcesar ? "Procesando..." : "Procesar CPE"}
            </Button>
          </div>
        </div>
      )}

      {resultado && e && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={form.handleSubmit(confirmar)} className="flex flex-col gap-6">
            {resultado.fuente === "claude" && (
              <p className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Este PDF no tenía texto seleccionable: los datos se extrajeron con ayuda de IA a
                partir de la imagen. Revisá todos los campos con cuidado antes de confirmar.
              </p>
            )}
            {resultado.fuente === "manual" && (
              <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                No se pudo extraer el contenido del PDF automáticamente. Cargá los datos a mano
                abajo (el PDF igual se guarda como adjunto).
              </p>
            )}
            {resultado.referenciaQr && (
              <p className="text-xs text-muted-foreground">
                Referencia leída del QR: {resultado.referenciaQr}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoBooleano form={form} name="tiene_cpe" label="Tiene Carta de Porte (CPE)" />
              <CampoTexto form={form} name="cpe_nro" label="N° CPE" />
              <CampoTexto form={form} name="ctg" label="CTG" />
              <CampoTexto form={form} name="cpe_fecha_emision" label="Fecha de emisión" tipo="date" />
              <CampoTexto form={form} name="ctg_vencimiento" label="Vencimiento del CTG" tipo="date" />
              <CampoTexto form={form} name="campania" label="Campaña" />
              <div className="flex flex-col gap-2">
                <Label>Declaración de calidad</Label>
                <Controller
                  control={form.control}
                  name="declaracion_calidad"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Verificar en el PDF..." />
                      </SelectTrigger>
                      <SelectContent>
                        {opcionesDeclaracion.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  El PDF no permite detectar cuál casillero está tildado — confirmá mirando la
                  vista previa.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoEntidadConCrear
                form={form}
                name="cliente_id"
                label="Cliente (titular)"
                opciones={opcionesClientes}
                onAbrirCrear={() =>
                  abrirCrear("cliente", "Nuevo cliente", e.titular_nombre ?? "", e.titular_cuit ?? "", "cliente_id")
                }
              />
              <CampoEntidadConCrear
                form={form}
                name="pagador_id"
                label="Flete pagador"
                opciones={opcionesClientes}
                onAbrirCrear={() =>
                  abrirCrear("cliente", "Nuevo cliente", e.pagador_nombre ?? "", e.pagador_cuit ?? "", "pagador_id")
                }
              />
              <CampoEntidadConCrear
                form={form}
                name="destinatario_id"
                label="Destinatario"
                opciones={opcionesClientes}
                onAbrirCrear={() =>
                  abrirCrear(
                    "cliente",
                    "Nuevo cliente",
                    e.destinatario_nombre ?? "",
                    e.destinatario_cuit ?? "",
                    "destinatario_id"
                  )
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoEntidadConCrear
                form={form}
                name="camion_id"
                label="Camión"
                opciones={opcionesCamiones}
                onAbrirCrear={() =>
                  abrirCrear("camion", "Nuevo camión", e.dominio_tractor ?? "", "", "camion_id")
                }
              />
              <CampoEntidadConCrear
                form={form}
                name="chofer_id"
                label="Chofer"
                opciones={opcionesChoferes}
                onAbrirCrear={() =>
                  abrirCrear("chofer", "Nuevo chofer", e.chofer_nombre ?? "", e.chofer_cuil ?? "", "chofer_id")
                }
              />
              <CampoTexto form={form} name="dominio_tractor" label="Dominio tractor" />
              <CampoTexto form={form} name="dominio_acoplado" label="Dominio acoplado" />
              <div className="flex flex-col gap-2">
                <Label>Producto</Label>
                <Controller
                  control={form.control}
                  name="producto_id"
                  render={({ field }) => (
                    <Select
                      value={field.value != null ? String(field.value) : undefined}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {opcionesProductos.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <CampoTexto form={form} name="km" label="Km a recorrer" tipo="number" />
              <CampoEntidadConCrear
                form={form}
                name="origen_id"
                label="Origen"
                opciones={opcionesLugares}
                onAbrirCrear={() =>
                  abrirCrear("lugar", "Nuevo lugar", e.origen_localidad ?? "", "", "origen_id")
                }
              />
              <CampoEntidadConCrear
                form={form}
                name="destino_id"
                label="Destino"
                opciones={opcionesLugares}
                onAbrirCrear={() =>
                  abrirCrear("lugar", "Nuevo lugar", e.destino_localidad ?? "", "", "destino_id")
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoTexto form={form} name="fecha_partida" label="Fecha de partida" tipo="date" />
              <CampoTexto form={form} name="bruto_origen" label="Peso bruto (origen, kg)" />
              <CampoTexto form={form} name="tara_origen" label="Tara (origen, kg)" />
              <CampoTexto form={form} name="neto_origen" label="Peso neto (origen, kg)" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Modalidad de tarifa</Label>
                <Controller
                  control={form.control}
                  name="modalidad_tarifa"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegir modalidad..." />
                      </SelectTrigger>
                      <SelectContent>
                        {opcionesModalidad.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <CampoTexto form={form} name="valor_tarifa" label="Valor de la tarifa ($)" />
              <div className="flex flex-col gap-2">
                <Label>Base de cálculo</Label>
                <Controller
                  control={form.control}
                  name="base_calculo"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegir base..." />
                      </SelectTrigger>
                      <SelectContent>
                        {opcionesBase.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />

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
