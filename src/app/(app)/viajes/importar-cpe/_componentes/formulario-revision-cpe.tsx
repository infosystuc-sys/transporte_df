"use client";

import { useMemo, useEffect, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
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
import type { EntidadFaltante, TipoEntidadFaltante } from "@/lib/cpe/matching";
import {
  confirmarImportacionCpe,
  crearCamionRapido,
  crearChoferRapido,
  crearClienteRapido,
  crearEntidadesFaltantes,
  crearLugarRapido,
  crearProductoRapido,
  importarCpe,
} from "../actions";

type Opcion = { value: string; label: string };
type TipoEntidad = TipoEntidadFaltante;

/** Documento sin puntos ni guiones, para comparar CUIT/CUIL entre roles. */
const soloDigitos = (v: string) => v.replace(/[^0-9]/g, "");

type GrupoFaltante = {
  huella: string;
  tipo: TipoEntidadFaltante;
  nombre: string;
  documento: string | null;
  /** Roles de la CPE que resuelve este mismo registro. */
  roles: string[];
};

/**
 * Agrupa los faltantes que son el mismo registro con distinto rol: en una
 * CPE es muy común que titular, destinatario y flete pagador sean la misma
 * empresa. Sin agrupar, el panel mostraría tres filas idénticas y diría
 * "dar de alta 3" cuando en realidad se crea un solo cliente.
 */
function agruparFaltantes(faltantes: EntidadFaltante[]): GrupoFaltante[] {
  const grupos = new Map<string, GrupoFaltante>();
  for (const f of faltantes) {
    const huella = `${f.tipo}:${(f.documento ? soloDigitos(f.documento) : f.nombre).toLowerCase()}`;
    const existente = grupos.get(huella);
    if (existente) {
      existente.roles.push(f.etiqueta);
      continue;
    }
    grupos.set(huella, {
      huella,
      tipo: f.tipo,
      nombre: f.nombre,
      documento: f.documento,
      roles: [f.etiqueta],
    });
  }
  return [...grupos.values()];
}

const ETIQUETAS_TIPO_FALTANTE: Record<TipoEntidadFaltante, string> = {
  cliente: "Cliente",
  chofer: "Chofer",
  camion: "Camión",
  producto: "Producto",
  lugar: "Lugar",
};

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

    // El cliente es el flete pagador: es a quien se le factura.
    cliente_id: (c.cliente_id ?? undefined) as unknown as number,
    // Solo estadísticos: no generan ficha de cliente.
    titular_nombre: e.titular_nombre ?? "",
    titular_cuit: e.titular_cuit ?? "",
    destinatario_nombre: e.destinatario_nombre ?? "",
    destinatario_cuit: e.destinatario_cuit ?? "",
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
    // Lo que trae la CPE es lo declarado en el documento, no necesariamente
    // lo que se termina cobrando — valor_tarifa (el real) queda vacío para
    // cargarlo a mano.
    valor_tarifa: numStr(null),
    valor_tarifa_declarada: numStr(e.valor_tarifa),
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
  const error = form.formState.errors[name]?.message as string | undefined;
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
      {error && <p className="text-sm text-destructive">{error}</p>}
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
        case "producto":
          resultado = await crearProductoRapido({ nombre, tipo: "grano" });
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
        form.reset(construirValoresIniciales(r));
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
      // Una opción por registro real creado, no por rol: si el mismo
      // cliente cubre tres roles, se agrega una sola vez al desplegable.
      for (const g of grupos) {
        const clave = faltantes.find(
          (f) =>
            `${f.tipo}:${(f.documento ? soloDigitos(f.documento) : f.nombre).toLowerCase()}` === g.huella
        )?.clave;
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
    // Si se creó a mano algo que estaba en la lista de faltantes, ya no
    // hace falta seguir ofreciéndolo en el panel.
    setFaltantes((prev) => prev.filter((f) => f.campo !== dialog.campo));
  }

  const e = resultado?.extraido;

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

      {resultado && e && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={form.handleSubmit(confirmar)} className="flex flex-col gap-6">
            {resultado.fuente === "claude" && (
              <p className="rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
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

            {grupos.length > 0 && (
              <div className="flex flex-col gap-3 rounded-md border border-amber/40 bg-amber/10 p-4">
                <div>
                  <h3 className="text-sm font-bold">
                    {grupos.length === 1
                      ? "Falta dar de alta 1 registro"
                      : `Faltan dar de alta ${grupos.length} registros`}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    La CPE menciona estos datos y todavía no existen en el sistema. Revisá que estén
                    bien leídos y confirmá para crearlos y dejarlos asignados al viaje.
                  </p>
                </div>

                <ul className="flex flex-col gap-2">
                  {grupos.map((g) => (
                    <li
                      key={g.huella}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md bg-card p-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{g.nombre}</span>
                        <span className="text-xs text-muted-foreground">
                          {ETIQUETAS_TIPO_FALTANTE[g.tipo]}
                          {g.documento && ` · ${g.documento}`}
                          {" · usar como "}
                          {g.roles.join(", ")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={darDeAltaFaltantes} disabled={isPendingFaltantes}>
                    {isPendingFaltantes
                      ? "Dando de alta..."
                      : grupos.length === 1
                        ? "Dar de alta 1 registro"
                        : `Dar de alta los ${grupos.length}`}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setFaltantes([])}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Los cargo a mano
                  </button>
                </div>
              </div>
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
                label="Cliente (flete pagador)"
                opciones={opcionesClientes}
                onAbrirCrear={() =>
                  abrirCrear("cliente", "Nuevo cliente", e.pagador_nombre ?? "", e.pagador_cuit ?? "", "cliente_id")
                }
              />
            </div>

            <div className="flex flex-col gap-3 rounded-md border p-4">
              <div>
                <h3 className="text-sm font-bold">Datos estadísticos</h3>
                <p className="text-sm text-muted-foreground">
                  Se guardan con el viaje solo para reportes. No se les factura, así que no se dan
                  de alta como clientes.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <CampoTexto form={form} name="titular_nombre" label="Titular de la carta de porte" />
                <CampoTexto form={form} name="titular_cuit" label="CUIT del titular" />
                <CampoTexto form={form} name="destinatario_nombre" label="Destinatario" />
                <CampoTexto form={form} name="destinatario_cuit" label="CUIT del destinatario" />
              </div>
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
              <CampoEntidadConCrear
                form={form}
                name="producto_id"
                label="Producto (especie)"
                opciones={opcionesProductos}
                onAbrirCrear={() =>
                  abrirCrear("producto", "Nuevo producto", e.producto_nombre ?? "", "", "producto_id")
                }
              />
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
              <CampoTexto
                form={form}
                name="valor_tarifa_declarada"
                label="Tarifa declarada (según documentación)"
              />
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
