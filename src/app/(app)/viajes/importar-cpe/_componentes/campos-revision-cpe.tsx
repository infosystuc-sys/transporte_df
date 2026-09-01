"use client";

import { useTransition } from "react";
import { Controller, useForm, type Path } from "react-hook-form";
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
import type { ViajeDesdeCpeInput } from "@/lib/schemas/cpe-importacion";
import { resolverCascadaTarifa, type BaseCalculo, type ModalidadTarifa } from "@/lib/tarifa-defaults";
import type { ResultadoImportacionCpe } from "@/lib/cpe/importar";
import type { EntidadFaltante, TipoEntidadFaltante } from "@/lib/cpe/matching";
import {
  crearCamionRapido,
  crearChoferRapido,
  crearClienteRapido,
  crearLugarRapido,
  crearProductoRapido,
} from "../actions";

export type Opcion = { value: string; label: string };
export type TipoEntidad = TipoEntidadFaltante;

/** Documento sin puntos ni guiones, para comparar CUIT/CUIL entre roles. */
const soloDigitos = (v: string) => v.replace(/[^0-9]/g, "");

export type GrupoFaltante = {
  huella: string;
  tipo: TipoEntidadFaltante;
  nombre: string;
  documento: string | null;
  /** Roles de la CPE que resuelve este mismo registro. */
  roles: string[];
};

/**
 * Única fórmula para calcular la huella de un faltante -- exportada para
 * que cualquier pantalla que necesite volver a encontrar a qué faltante
 * corresponde un grupo (después de darlo de alta) use exactamente el
 * mismo cálculo que `agruparFaltantes`. Antes esta fórmula estaba
 * duplicada inline en el handler de "dar de alta" de la pantalla de una
 * sola CPE, con una diferencia sutil (sin aplicar soloDigitos) que la
 * desincronizaba de esta función apenas un documento traía puntos o
 * guiones -- de ahí que ahora viva en un solo lugar.
 */
export function calcularHuellaFaltante(f: EntidadFaltante): string {
  return `${f.tipo}:${(f.documento ? soloDigitos(f.documento) : f.nombre).toLowerCase()}`;
}

/**
 * Agrupa los faltantes que son el mismo registro con distinto rol: en una
 * CPE es muy común que titular, destinatario y flete pagador sean la misma
 * empresa. Sin agrupar, el panel mostraría tres filas idénticas y diría
 * "dar de alta 3" cuando en realidad se crea un solo cliente.
 *
 * También sirve tal cual para consolidar faltantes de VARIAS CPE a la vez
 * (Importar CPE en tanda): alcanza con pasarle la concatenación de los
 * `faltantes` de cada resultado -- la deduplicación por huella ya cubre
 * el caso de que el mismo cliente/chofer se repita entre archivos.
 */
export function agruparFaltantes(faltantes: EntidadFaltante[]): GrupoFaltante[] {
  const grupos = new Map<string, GrupoFaltante>();
  for (const f of faltantes) {
    const huella = calcularHuellaFaltante(f);
    const existente = grupos.get(huella);
    if (existente) {
      if (!existente.roles.includes(f.etiqueta)) existente.roles.push(f.etiqueta);
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

/** Etiquetas en español de campos_dudosos, para el aviso de "revisá esto con más cuidado". */
const ETIQUETAS_CAMPOS_CPE: Record<string, string> = {
  ctg: "CTG",
  cpe_nro: "N° CPE",
  campania: "Campaña",
  titular_cuit: "CUIT del titular",
  titular_nombre: "Titular de la carta de porte",
  destinatario_cuit: "CUIT del destinatario",
  destinatario_nombre: "Destinatario",
  pagador_cuit: "CUIT del cliente (flete pagador)",
  pagador_nombre: "Cliente (flete pagador)",
  chofer_cuil: "CUIL del chofer",
  chofer_nombre: "Chofer",
  producto_nombre: "Producto",
  origen_localidad: "Localidad de origen",
  origen_provincia: "Provincia de origen",
  destino_n_planta: "N° de planta de destino",
  destino_direccion: "Dirección de destino",
  destino_localidad: "Localidad de destino",
  destino_provincia: "Provincia de destino",
  dominio_tractor: "Dominio tractor",
  dominio_acoplado: "Dominio acoplado",
  n_turno_descarga: "N° de turno",
  bruto_origen_kg: "Peso bruto (origen)",
  tara_origen_kg: "Tara (origen)",
  neto_origen_kg: "Peso neto (origen)",
  km: "Km a recorrer",
  valor_tarifa: "Tarifa",
};

export function construirValoresIniciales(
  resultado: ResultadoImportacionCpe,
  clientes: { id: number; base_calculo_flete: BaseCalculo | "heredar" | null }[],
  configDefaults: {
    base_calculo_flete_default: BaseCalculo | null;
    modalidad_tarifa_default: ModalidadTarifa | null;
  }
): ViajeDesdeCpeInput {
  const { extraido: e, coincidencias: c } = resultado;
  const cliente = clientes.find((cl) => cl.id === c.cliente_id);
  const { baseCalculo, modalidadTarifa } = resolverCascadaTarifa(
    cliente?.base_calculo_flete,
    configDefaults
  );
  return {
    tiene_cpe: true,
    tipo_carga: "grano",
    cpe_nro: e.cpe_nro ?? "",
    // El QR es más confiable que la lectura de texto/IA para este campo
    // puntual (siempre trae el CTG, aunque el resto de la imagen esté
    // ilegible) -- si la extracción no lo encontró, se usa esa referencia
    // como default en vez de dejarlo en blanco.
    ctg: e.ctg ?? resultado.referenciaQr ?? "",
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
    // Si la CPE no trae una fecha de partida propia, la fecha de emisión
    // suele coincidir con la fecha real de carga en la práctica -- se usa
    // como respaldo editable en vez de dejar el campo vacío. Si la CPE sí
    // trae su propia fecha de partida (más específica, con hora), esa se
    // respeta y no se pisa.
    fecha_partida: soloFecha(e.fecha_partida ?? e.cpe_fecha_emision) as unknown as Date | undefined,
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

    // Precargados con la misma cascada de defaults que recalcularFlete
    // usa para autocorregir un viaje ya existente (cliente > config
    // global) -- así el usuario ve el valor correcto acá mismo, antes de
    // crear el viaje, en vez de que quede en blanco hasta el próximo
    // guardado. Siempre editables si hace falta corregirlos.
    modalidad_tarifa: modalidadTarifa ?? undefined,
    // En la inmensa mayoría de los viajes la tarifa que se termina
    // cobrando es la misma que declara la CPE -- precargarla ahorra
    // retipearla, y sigue siendo editable acá mismo para el caso
    // (excepcional) en que difiera de lo declarado.
    valor_tarifa: numStr(e.valor_tarifa),
    valor_tarifa_declarada: numStr(e.valor_tarifa),
    base_calculo: baseCalculo,
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

export function DialogCrearRapido({
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

/**
 * Todo lo editable de la revisión de una CPE: avisos, panel de faltantes y
 * la grilla de campos. No incluye el <form> que lo envuelve ni los botones
 * de confirmar/cancelar -- eso lo maneja cada pantalla que lo usa (la de
 * una sola CPE y, más adelante, el detalle de cada fila en la tanda),
 * porque el comportamiento de "confirmar" difiere entre una y otra.
 */
export function CamposRevisionCpe({
  form,
  resultado,
  grupos,
  isPendingFaltantes,
  onDarDeAltaFaltantes,
  onDescartarFaltantes,
  opcionesClientes,
  opcionesCamiones,
  opcionesChoferes,
  opcionesProductos,
  opcionesLugares,
  onAbrirCrear,
}: {
  form: ReturnType<typeof useForm<ViajeDesdeCpeInput>>;
  resultado: ResultadoImportacionCpe;
  grupos: GrupoFaltante[];
  isPendingFaltantes: boolean;
  onDarDeAltaFaltantes: () => void;
  onDescartarFaltantes: () => void;
  opcionesClientes: Opcion[];
  opcionesCamiones: Opcion[];
  opcionesChoferes: Opcion[];
  opcionesProductos: Opcion[];
  opcionesLugares: Opcion[];
  onAbrirCrear: (
    tipo: TipoEntidad,
    titulo: string,
    nombre: string,
    extra: string,
    campo: Path<ViajeDesdeCpeInput>
  ) => void;
}) {
  const e = resultado.extraido;

  return (
    <>
      {resultado.motivoManual === "ilegible" && (
        <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          La IA no pudo leer bien el documento (foto borrosa, con poca luz, o mal encuadrada).
          Probá sacar la foto de nuevo con más luz, más de cerca y bien derecha, o cargá los datos
          a mano abajo (el archivo igual se guarda como adjunto).
        </p>
      )}
      {resultado.motivoManual === "sin_conexion_ia" && (
        <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          No se pudo conectar con la IA para leer el documento (no es un problema de la foto).
          Cargá los datos a mano abajo (el archivo igual se guarda como adjunto).
        </p>
      )}
      {resultado.fuente === "claude" && !resultado.motivoManual && (
        <p className="rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
          Este PDF no tenía texto seleccionable: los datos se extrajeron con ayuda de IA a partir
          de la imagen. Revisá todos los campos con cuidado antes de confirmar.
        </p>
      )}
      {resultado.fuente === "claude" && e.campos_dudosos.length > 0 && (
        <p className="rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
          La IA no está segura de estos campos (foto poco clara en esa zona) — revisalos con más
          atención: {e.campos_dudosos.map((c) => ETIQUETAS_CAMPOS_CPE[c] ?? c).join(", ")}.
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
            <Button type="button" onClick={onDarDeAltaFaltantes} disabled={isPendingFaltantes}>
              {isPendingFaltantes
                ? "Dando de alta..."
                : grupos.length === 1
                  ? "Dar de alta 1 registro"
                  : `Dar de alta los ${grupos.length}`}
            </Button>
            <button
              type="button"
              onClick={onDescartarFaltantes}
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
              <Select value={field.value ?? undefined} onValueChange={field.onChange}>
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
            El PDF no permite detectar cuál casillero está tildado — confirmá mirando la vista
            previa.
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
            onAbrirCrear("cliente", "Nuevo cliente", e.pagador_nombre ?? "", e.pagador_cuit ?? "", "cliente_id")
          }
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-4">
        <div>
          <h3 className="text-sm font-bold">Datos estadísticos</h3>
          <p className="text-sm text-muted-foreground">
            Se guardan con el viaje solo para reportes. No se les factura, así que no se dan de
            alta como clientes.
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
          onAbrirCrear={() => onAbrirCrear("camion", "Nuevo camión", e.dominio_tractor ?? "", "", "camion_id")}
        />
        <CampoEntidadConCrear
          form={form}
          name="chofer_id"
          label="Chofer"
          opciones={opcionesChoferes}
          onAbrirCrear={() =>
            onAbrirCrear("chofer", "Nuevo chofer", e.chofer_nombre ?? "", e.chofer_cuil ?? "", "chofer_id")
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
            onAbrirCrear("producto", "Nuevo producto", e.producto_nombre ?? "", "", "producto_id")
          }
        />
        <CampoTexto form={form} name="km" label="Km a recorrer" tipo="number" />
        <CampoEntidadConCrear
          form={form}
          name="origen_id"
          label="Origen"
          opciones={opcionesLugares}
          onAbrirCrear={() => onAbrirCrear("lugar", "Nuevo lugar", e.origen_localidad ?? "", "", "origen_id")}
        />
        <CampoEntidadConCrear
          form={form}
          name="destino_id"
          label="Destino"
          opciones={opcionesLugares}
          onAbrirCrear={() => onAbrirCrear("lugar", "Nuevo lugar", e.destino_localidad ?? "", "", "destino_id")}
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
        <CampoTexto form={form} name="valor_tarifa_declarada" label="Tarifa declarada (según documentación)" />
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
    </>
  );
}
