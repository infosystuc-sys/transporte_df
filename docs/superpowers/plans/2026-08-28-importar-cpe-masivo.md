# Importar CPE en tanda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir subir varios archivos de CPE de una sola vez y revisarlos/confirmarlos desde un checklist, sin repetir el ciclo completo de subir→revisar→confirmar→volver por cada uno.

**Architecture:** Página nueva (`/viajes/importar-cpe-masivo`) que reutiliza toda la lógica de lectura/matching/creación de viajes que ya existe para una sola CPE. Los archivos se procesan secuencialmente en el cliente (un `await` por archivo, en orden) contra la misma acción de servidor `importarCpe`. El formulario de campos editables se extrae a un componente compartido para no duplicarlo entre la pantalla de una sola CPE y el "ver detalle" de la tanda. Confirmar una fila de la tanda usa una acción de servidor nueva que no redirige (a diferencia de la existente, pensada para una sola CPE).

**Tech Stack:** Next.js 16 App Router (Server Actions), React Hook Form + Zod, Drizzle ORM/Postgres, TypeScript. Sin framework de tests en el proyecto (`package.json` no tiene vitest/jest) — la verificación de este proyecto siempre fue manual, contra datos reales, en el navegador (local con `next dev` cuando no hace falta la IA real, contra producción cuando sí hace falta `ANTHROPIC_API_KEY`). Cada tarea de este plan sigue ese mismo patrón: cambiar código → `npx tsc --noEmit -p .` → verificar en el navegador → commit.

## Global Constraints

- No se toca el comportamiento de `/viajes/importar-cpe` (una sola CPE): debe funcionar exactamente igual que hoy después de cada tarea de refactor.
- No hay `ANTHROPIC_API_KEY` en `.env.local` — cualquier verificación que dependa de la lectura real por IA se hace contra producción (`https://transporte-df.vercel.app`), nunca contra el servidor local.
- Seguir el estilo de comentarios del proyecto: sin comentarios que expliquen "qué" hace el código (los nombres ya lo dicen), solo el "por qué" cuando no es obvio.
- Todo archivo nuevo bajo `src/app/(app)/viajes/importar-cpe-masivo/` sigue la convención de carpetas ya usada por `importar-cpe/` y `importar-descarga/` (page.tsx + `_componentes/`).

---

### Task 1: Extraer los campos del formulario de revisión a un componente compartido

**Files:**
- Create: `src/app/(app)/viajes/importar-cpe/_componentes/campos-revision-cpe.tsx`
- Modify: `src/app/(app)/viajes/importar-cpe/_componentes/formulario-revision-cpe.tsx`

**Interfaces:**
- Produces (usado por Task 7): `CamposRevisionCpe` (componente), `DialogCrearRapido` (componente), `construirValoresIniciales(resultado: ResultadoImportacionCpe, clientes: {id:number; base_calculo_flete: BaseCalculo|"heredar"|null}[], configDefaults: {base_calculo_flete_default: BaseCalculo|null; modalidad_tarifa_default: ModalidadTarifa|null}): ViajeDesdeCpeInput`, `agruparFaltantes(faltantes: EntidadFaltante[]): GrupoFaltante[]`, `calcularHuellaFaltante(f: EntidadFaltante): string`, tipos `Opcion = {value:string; label:string}`, `TipoEntidad = TipoEntidadFaltante`, `GrupoFaltante = {huella:string; tipo:TipoEntidadFaltante; nombre:string; documento:string|null; roles:string[]}`.

Este task es un refactor puro: mueve código existente (verbatim) a un archivo nuevo y lo importa desde donde vivía. No cambia ningún comportamiento visible.

- [ ] **Step 1: Crear el archivo compartido con todo lo reutilizable**

Crear `src/app/(app)/viajes/importar-cpe/_componentes/campos-revision-cpe.tsx` con este contenido exacto (es el código que hoy vive en `formulario-revision-cpe.tsx` entre las líneas 1 y 340, más una nueva función `CamposRevisionCpe` que agrupa el JSX de las líneas 545-803 de ese mismo archivo):

```tsx
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
```

- [ ] **Step 2: Reescribir `formulario-revision-cpe.tsx` para usar el componente compartido**

Reemplazar todo el contenido de `src/app/(app)/viajes/importar-cpe/_componentes/formulario-revision-cpe.tsx` por:

```tsx
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
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores.

- [ ] **Step 4: Verificar en el navegador que la pantalla de una sola CPE sigue igual**

```bash
# desde la raíz del proyecto
```

Arrancar el server local (`preview_start` con el nombre `transporte-df-dev` de
`.claude/launch.json`, o `npm run dev` si se corre a mano), entrar a `/viajes/importar-cpe`,
subir cualquier PDF de prueba y confirmar que la pantalla se ve y comporta exactamente igual que
antes del refactor (mismos campos, mismo panel de faltantes si aplica, mismo botón "Confirmar y
crear viaje"). No hace falta que la IA lea nada para este chequeo — alcanza con confirmar que no
hay errores de consola y que el layout no se rompió.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/viajes/importar-cpe/_componentes/campos-revision-cpe.tsx src/app/\(app\)/viajes/importar-cpe/_componentes/formulario-revision-cpe.tsx
git commit -m "Extrae los campos de revision de CPE a un componente compartido"
```

---

### Task 2: Extraer la carga de catálogos a una función compartida

**Files:**
- Create: `src/lib/cpe/datos-catalogos.ts`
- Modify: `src/app/(app)/viajes/importar-cpe/page.tsx`

**Interfaces:**
- Produces (usado por Task 4): `obtenerCatalogosImportacionCpe(): Promise<CatalogosImportacionCpe>`, tipo `CatalogosImportacionCpe`.

- [ ] **Step 1: Crear `src/lib/cpe/datos-catalogos.ts`**

```ts
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, configuracion, lugares, productos } from "@/db/schema";
import type { BaseCalculo, ModalidadTarifa } from "@/lib/tarifa-defaults";

export type CatalogosImportacionCpe = {
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
};

/**
 * Catálogos que necesita la pantalla de revisión de CPE (una sola o en
 * tanda) para poblar los selects y resolver la cascada de tarifa. Extraído
 * de importar-cpe/page.tsx para que la pantalla de tanda (importar-cpe-
 * masivo) no repita la misma consulta.
 */
export async function obtenerCatalogosImportacionCpe(): Promise<CatalogosImportacionCpe> {
  const [filasClientes, filasCamiones, filasChoferes, filasProductos, filasLugares, filaConfig] =
    await Promise.all([
      db
        .select({
          id: clientes.id,
          nombre: clientes.razon_social,
          cuit: clientes.cuit,
          base_calculo_flete: clientes.base_calculo_flete,
        })
        .from(clientes)
        .orderBy(asc(clientes.razon_social)),
      db
        .select({
          id: camiones.id,
          dominio_tractor: camiones.dominio_tractor,
          dominio_acoplado: camiones.dominio_acoplado,
        })
        .from(camiones)
        .orderBy(asc(camiones.dominio_tractor)),
      db
        .select({ id: choferes.id, nombre: choferes.nombre_completo, cuil: choferes.cuil })
        .from(choferes)
        .orderBy(asc(choferes.nombre_completo)),
      db.select({ id: productos.id, nombre: productos.nombre }).from(productos).orderBy(asc(productos.nombre)),
      db.select({ id: lugares.id, nombre: lugares.nombre }).from(lugares).orderBy(asc(lugares.nombre)),
      db
        .select({
          base_calculo_flete_default: configuracion.base_calculo_flete_default,
          modalidad_tarifa_default: configuracion.modalidad_tarifa_default,
        })
        .from(configuracion)
        .limit(1),
    ]);

  return {
    clientes: filasClientes,
    camiones: filasCamiones,
    choferes: filasChoferes,
    productos: filasProductos,
    lugares: filasLugares,
    configDefaults: filaConfig[0] ?? {
      base_calculo_flete_default: null,
      modalidad_tarifa_default: null,
    },
  };
}
```

- [ ] **Step 2: Usar la función nueva en `importar-cpe/page.tsx`**

Reemplazar todo el contenido de `src/app/(app)/viajes/importar-cpe/page.tsx` por:

```tsx
import type { Metadata } from "next";
import { obtenerCatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";
import { FormularioRevisionCpe } from "./_componentes/formulario-revision-cpe";

export const metadata: Metadata = {
  title: "Importar CPE — Gestión de Fletes",
};

export default async function ImportarCpePage() {
  const catalogos = await obtenerCatalogosImportacionCpe();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar CPE</h1>
        <p className="text-sm text-muted-foreground">
          Subí el PDF o una foto de la Carta de Porte Electrónica: el sistema intenta completar los
          datos del viaje automáticamente, pero siempre revisás y confirmás antes de guardar nada.
        </p>
      </div>
      <FormularioRevisionCpe {...catalogos} />
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores.

- [ ] **Step 4: Verificar en el navegador**

Recargar `/viajes/importar-cpe` en local y confirmar que los selects de Cliente/Camión/Chofer/
Producto/Origen/Destino siguen poblados igual que antes (mismos catálogos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cpe/datos-catalogos.ts src/app/\(app\)/viajes/importar-cpe/page.tsx
git commit -m "Extrae la carga de catalogos de Importar CPE a una funcion compartida"
```

---

### Task 3: Acciones de servidor para confirmar sin redirigir y verificar CTG existente

**Files:**
- Modify: `src/app/(app)/viajes/importar-cpe/actions.ts`

**Interfaces:**
- Consumes: `viajeDesdeCpeSchema`, `ViajeDesdeCpeInput` (`@/lib/schemas/cpe-importacion`), `recalcularMerma`, `recalcularFlete`, `recalcularLiquidacionChofer`, `avanzarEstadoAutomatico` (ya importados), `buscarViajesPorCtg` de `../_lib/buscar-ctg` (Produces: `ViajeEncontradoPorCtg`).
- Produces (usado por Task 7): `confirmarImportacionCpeEnTanda(formData: FormData): Promise<{ error: string } | { viajeId: number }>`, `verificarCtgExistente(ctg: string): Promise<ViajeEncontradoPorCtg[]>`. `confirmarImportacionCpe` mantiene la misma firma y comportamiento que hoy.

- [ ] **Step 1: Extraer la lógica común de crear el viaje + subir el adjunto**

En `src/app/(app)/viajes/importar-cpe/actions.ts`, agregar el import de `buscarViajesPorCtg` y
reemplazar la función `confirmarImportacionCpe` actual por esto (crea dos funciones internas
compartidas y dos exports: la que ya existe, sin cambios de comportamiento, y la nueva para la
tanda):

```ts
import { buscarViajesPorCtg, type ViajeEncontradoPorCtg } from "../_lib/buscar-ctg";
```

```ts
async function crearViajeDesdeCpe(datos: ReturnType<typeof viajeDesdeCpeSchema.parse>) {
  const [viaje] = await db.insert(viajes).values(datos).returning({ id: viajes.id });
  await recalcularMerma(viaje.id);
  await recalcularFlete(viaje.id);
  await recalcularLiquidacionChofer(viaje.id);
  // La pantalla de revisión junta generales + carga + descarga + tarifa
  // en un solo guardado -- si ya venían fecha_partida/fecha_descarga
  // cargadas desde la CPE, el viaje puede nacer directamente más
  // adelante en la secuencia, no siempre en "planificado".
  await avanzarEstadoAutomatico(viaje.id);
  return viaje;
}

async function subirAdjuntoDeCpe(viajeId: number, archivo: File) {
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const rutaStorage = `viaje/${viajeId}/${randomUUID()}-${archivo.name}`;
  await subirAdjunto(rutaStorage, buffer, archivo.type || "application/pdf");
  await db.insert(adjuntos).values({
    entidad: "viaje",
    entidad_id: viajeId,
    tipo: "cpe_pdf",
    nombre_archivo: archivo.name,
    storage_path: rutaStorage,
  });
}

/**
 * Crea el viaje con los campos editados en la pantalla de revisión (que
 * abarcan generales + carga + descarga + tarifa de una sola vez), sube el
 * PDF original a Storage y lo deja registrado como adjunto tipo "cpe_pdf".
 */
export async function confirmarImportacionCpe(
  formData: FormData
): Promise<{ error?: string } | void> {
  const archivo = archivoDeFormData(formData);
  const datosJson = formData.get("datos");
  if (typeof datosJson !== "string") {
    return { error: "Faltan los datos del viaje." };
  }

  const datos = viajeDesdeCpeSchema.parse(JSON.parse(datosJson) as ViajeDesdeCpeInput);
  const viaje = await crearViajeDesdeCpe(datos);
  await subirAdjuntoDeCpe(viaje.id, archivo);

  redirect(`/viajes/${viaje.id}`);
}

/**
 * Misma lógica que confirmarImportacionCpe, pero para una fila del
 * checklist de Importar CPE en tanda: no puede redirigir (sacaría al
 * usuario del checklist antes de terminar de confirmar el resto), así que
 * devuelve el id del viaje creado en vez de navegar.
 */
export async function confirmarImportacionCpeEnTanda(
  formData: FormData
): Promise<{ error: string } | { viajeId: number }> {
  const archivo = archivoDeFormData(formData);
  const datosJson = formData.get("datos");
  if (typeof datosJson !== "string") {
    return { error: "Faltan los datos del viaje." };
  }

  const datos = viajeDesdeCpeSchema.parse(JSON.parse(datosJson) as ViajeDesdeCpeInput);
  const viaje = await crearViajeDesdeCpe(datos);
  await subirAdjuntoDeCpe(viaje.id, archivo);

  revalidatePath("/viajes");
  return { viajeId: viaje.id };
}

/** Viajes ya cargados con este CTG -- para avisar de un posible duplicado antes de confirmar. */
export async function verificarCtgExistente(ctg: string): Promise<ViajeEncontradoPorCtg[]> {
  if (!ctg.trim()) return [];
  return buscarViajesPorCtg(ctg.trim());
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores. Si `viajeDesdeCpeSchema.parse(...)` no infiere bien el tipo del parámetro
de `crearViajeDesdeCpe`, tipar explícitamente ese parámetro como `typeof datos` inline (mover la
llamada a `.parse` antes de declarar la función, como ya está en el snippet de arriba) en vez de
usar `ReturnType<typeof ...parse>` como tipo del parámetro -- usar directamente el tipo inferido
de la variable `datos` es más simple y menos frágil.

- [ ] **Step 3: Verificar que Importar CPE (una sola) sigue funcionando**

En local, repetir el chequeo del Task 1 (subir un PDF en `/viajes/importar-cpe`, confirmar que el
formulario se ve igual). Sin `ANTHROPIC_API_KEY` local no se puede completar un alta real de punta
a punta acá -- ese chequeo completo (crear el viaje de verdad) queda para el Task 9, contra
producción.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/viajes/importar-cpe/actions.ts
git commit -m "Agrega confirmarImportacionCpeEnTanda y verificarCtgExistente"
```

---

### Task 4: Página nueva `/viajes/importar-cpe-masivo`

**Files:**
- Create: `src/app/(app)/viajes/importar-cpe-masivo/page.tsx`
- Create: `src/app/(app)/viajes/importar-cpe-masivo/_componentes/importador-masivo-cpe.tsx` (esqueleto vacío, se completa en los Tasks 5-7)

**Interfaces:**
- Consumes: `obtenerCatalogosImportacionCpe` (Task 2), `CatalogosImportacionCpe` (Task 2).
- Produces: ruta `/viajes/importar-cpe-masivo` navegable.

- [ ] **Step 1: Crear la página**

```tsx
// src/app/(app)/viajes/importar-cpe-masivo/page.tsx
import type { Metadata } from "next";
import { obtenerCatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";
import { ImportadorMasivoCpe } from "./_componentes/importador-masivo-cpe";

export const metadata: Metadata = {
  title: "Importar CPE (varios) — Gestión de Fletes",
};

export default async function ImportarCpeMasivoPage() {
  const catalogos = await obtenerCatalogosImportacionCpe();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar CPE (varios)</h1>
        <p className="text-sm text-muted-foreground">
          Subí varios PDF o fotos de una: la app los va leyendo uno por uno y te deja confirmar
          cada viaje sin salir de esta pantalla.
        </p>
      </div>
      <ImportadorMasivoCpe {...catalogos} />
    </div>
  );
}
```

- [ ] **Step 2: Crear el esqueleto del componente cliente**

```tsx
// src/app/(app)/viajes/importar-cpe-masivo/_componentes/importador-masivo-cpe.tsx
"use client";

import type { CatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";

export function ImportadorMasivoCpe(_catalogos: CatalogosImportacionCpe) {
  return <p className="text-sm text-muted-foreground">Próximamente.</p>;
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores (el `_catalogos` con guion bajo evita el warning de variable sin usar en
este esqueleto intermedio).

- [ ] **Step 4: Verificar en el navegador**

Navegar a `http://localhost:3000/viajes/importar-cpe-masivo` en local y confirmar que carga el
título y el texto "Próximamente." sin errores de consola.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/viajes/importar-cpe-masivo/
git commit -m "Agrega la ruta de Importar CPE en tanda (esqueleto)"
```

---

### Task 5: Selección de varios archivos y procesamiento secuencial

**Files:**
- Modify: `src/app/(app)/viajes/importar-cpe-masivo/_componentes/importador-masivo-cpe.tsx`

**Interfaces:**
- Consumes: `importarCpe(formData: FormData): Promise<ResultadoImportacionCpe>` (de `../../importar-cpe/actions`, ya existe).
- Produces (usado por Tasks 6-7): tipo `ItemLote`, `type EstadoItem`.

- [ ] **Step 1: Implementar el estado por archivo y el procesamiento secuencial**

```tsx
// src/app/(app)/viajes/importar-cpe-masivo/_componentes/importador-masivo-cpe.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";
import type { ResultadoImportacionCpe } from "@/lib/cpe/importar";
import { importarCpe } from "../../importar-cpe/actions";

export type EstadoItem = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLote = {
  id: string;
  archivo: File;
  estado: EstadoItem;
  resultado: ResultadoImportacionCpe | null;
  error: string | null;
  viajeId: number | null;
};

const ETIQUETAS_ESTADO: Record<EstadoItem, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando...",
  listo: "Listo",
  revisar: "Revisar",
  error: "Error",
  confirmado: "Confirmado",
};

export function ImportadorMasivoCpe(_catalogos: CatalogosImportacionCpe) {
  const [items, setItems] = useState<ItemLote[]>([]);
  const [procesando, setProcesando] = useState(false);

  function actualizarItem(id: string, cambios: Partial<ItemLote>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  async function procesarUno(item: ItemLote) {
    actualizarItem(item.id, { estado: "procesando" });
    try {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      const r = await importarCpe(formData);
      const necesitaRevision = r.motivoManual != null || r.extraido.campos_dudosos.length > 0;
      actualizarItem(item.id, { estado: necesitaRevision ? "revisar" : "listo", resultado: r });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      actualizarItem(item.id, { estado: "error", error: mensaje });
    }
  }

  async function onSeleccionarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    const nuevosItems: ItemLote[] = archivos.map((archivo) => ({
      id: crypto.randomUUID(),
      archivo,
      estado: "pendiente",
      resultado: null,
      error: null,
      viajeId: null,
    }));
    setItems(nuevosItems);
    e.target.value = "";

    setProcesando(true);
    for (const item of nuevosItems) {
      await procesarUno(item);
    }
    setProcesando(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivos-cpe">Archivos o fotos de las CPE</Label>
          <Input
            id="archivos-cpe"
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            onChange={onSeleccionarArchivos}
            disabled={procesando}
          />
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border p-4">
          <h3 className="text-sm font-bold">Procesando {items.length} archivo(s)</h3>
          <ul className="flex flex-col gap-1">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{it.archivo.name}</span>
                <span className="text-muted-foreground">
                  {ETIQUETAS_ESTADO[it.estado]}
                  {it.estado === "error" && it.error ? ` — ${it.error}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores.

- [ ] **Step 3: Verificar en el navegador (local, sin IA real)**

En `/viajes/importar-cpe-masivo`, seleccionar 2-3 archivos cualquiera (aunque no sean CPE reales
-- alcanza con confirmar el flujo). Sin `ANTHROPIC_API_KEY` local, cada uno va a terminar en
"Revisar" o en un estado con motivoManual "sin_conexion_ia" (no en "Error", salvo que el archivo
sea directamente inválido) -- lo que hay que verificar acá es que la lista aparece, que los
estados van cambiando de a uno EN ORDEN (no todos a la vez), y que no hay errores de consola.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/viajes/importar-cpe-masivo/_componentes/importador-masivo-cpe.tsx
git commit -m "Procesa varios archivos de CPE secuencialmente con estado por archivo"
```

---

### Task 6: Panel consolidado de "faltan dar de alta"

**Files:**
- Modify: `src/app/(app)/viajes/importar-cpe-masivo/_componentes/importador-masivo-cpe.tsx`

**Interfaces:**
- Consumes: `agruparFaltantes`, `GrupoFaltante` (de `../../importar-cpe/_componentes/campos-revision-cpe`, Task 1), `crearEntidadesFaltantes` (de `../../importar-cpe/actions`, ya existe, sin cambios de firma).
- Produces (usado por Task 7): el campo `coincidencias` de cada `item.resultado` queda actualizado in-place con los IDs recién creados, y `item.resultado.faltantes` queda sin las entradas ya resueltas.

- [ ] **Step 1: Agregar el panel y la lógica de aplicar los IDs creados a cada item**

Modificar `importador-masivo-cpe.tsx`: agregar los imports de `agruparFaltantes`/`GrupoFaltante`
y de `crearEntidadesFaltantes` y `useTransition`/`useMemo`, y sumar este bloque de estado y
funciones dentro del componente (después de `const [procesando, setProcesando] = useState(false);`):

```tsx
const [isPendingFaltantes, startTransitionFaltantes] = useTransition();

const todosListos = items.length > 0 && !procesando;
const grupos = useMemo(
  () => agruparFaltantes(items.flatMap((it) => it.resultado?.faltantes ?? [])),
  [items]
);

function darDeAltaFaltantesGlobal() {
  startTransitionFaltantes(async () => {
    // Cada item aporta sus propios faltantes con la clave prefijada por su
    // id: los `clave` que arma detectarFaltantes son roles fijos
    // ("cliente", "chofer", ...) que se repiten en cada CPE -- sin
    // prefijar, dos archivos con faltantes de rol "cliente" pero de
    // registros DISTINTOS pisarían la misma entrada en el resultado.
    const faltantesConClavePrefijada = items.flatMap(
      (it) =>
        it.resultado?.faltantes.map((f) => ({ ...f, clave: `${it.id}:${f.clave}` })) ?? []
    );
    if (faltantesConClavePrefijada.length === 0) return;

    const r = await crearEntidadesFaltantes({ faltantes: faltantesConClavePrefijada });
    if (r.error || !r.creadas) {
      toast.error(r.error ?? "No se pudieron dar de alta los registros.");
      return;
    }
    const creadas = r.creadas;

    setItems((prev) =>
      prev.map((it) => {
        if (!it.resultado) return it;
        const coincidencias = { ...it.resultado.coincidencias };
        const faltantesRestantes = it.resultado.faltantes.filter((f) => {
          const id = creadas[`${it.id}:${f.clave}`];
          if (id == null) return true;
          (coincidencias as Record<string, number | null>)[f.campo] = id;
          return false;
        });
        return { ...it, resultado: { ...it.resultado, coincidencias, faltantes: faltantesRestantes } };
      })
    );

    toast.success(
      grupos.length === 1 ? "Se dio de alta 1 registro." : `Se dieron de alta ${grupos.length} registros.`
    );
  });
}

function descartarFaltantesGlobal() {
  setItems((prev) =>
    prev.map((it) => (it.resultado ? { ...it, resultado: { ...it.resultado, faltantes: [] } } : it))
  );
}
```

Agregar el import de `toast` (`sonner`) y renderizar el panel dentro del JSX, entre el bloque de
"Procesando N archivo(s)" y el cierre del `<div>` exterior:

```tsx
{todosListos && grupos.length > 0 && (
  <div className="flex flex-col gap-3 rounded-md border border-amber/40 bg-amber/10 p-4">
    <div>
      <h3 className="text-sm font-bold">
        {grupos.length === 1
          ? "Falta dar de alta 1 registro"
          : `Faltan dar de alta ${grupos.length} registros`}
      </h3>
      <p className="text-sm text-muted-foreground">
        Contando todos los archivos de esta tanda. Revisá que estén bien leídos y confirmá para
        crearlos y dejarlos asignados a los viajes que los necesitan.
      </p>
    </div>
    <ul className="flex flex-col gap-2">
      {grupos.map((g: GrupoFaltante) => (
        <li key={g.huella} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md bg-card p-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{g.nombre}</span>
            <span className="text-xs text-muted-foreground">
              {g.documento && `${g.documento} · `}usar como {g.roles.join(", ")}
            </span>
          </div>
        </li>
      ))}
    </ul>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={darDeAltaFaltantesGlobal} disabled={isPendingFaltantes}>
        {isPendingFaltantes
          ? "Dando de alta..."
          : grupos.length === 1
            ? "Dar de alta 1 registro"
            : `Dar de alta los ${grupos.length}`}
      </Button>
      <button type="button" onClick={descartarFaltantesGlobal} className="text-xs text-muted-foreground hover:underline">
        Los cargo a mano
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/viajes/importar-cpe-masivo/_componentes/importador-masivo-cpe.tsx
git commit -m "Consolida los faltantes de toda la tanda en un solo panel"
```

Nota: este panel se verifica de verdad recién en el Task 9 (contra producción, con archivos
reales que generen faltantes) -- localmente, sin `ANTHROPIC_API_KEY`, `resultado.faltantes` viene
vacío para todos los items (la extracción cae siempre a "sin_conexion_ia" antes de llegar al
matching), así que el panel no tiene forma de aparecer en este entorno.

---

### Task 7: Checklist con confirmar/ver detalle, y aviso de CTG repetido

**Files:**
- Modify: `src/app/(app)/viajes/importar-cpe-masivo/_componentes/importador-masivo-cpe.tsx`

**Interfaces:**
- Consumes: `CamposRevisionCpe`, `DialogCrearRapido`, `construirValoresIniciales`, `agruparFaltantes`, `calcularHuellaFaltante`, `type GrupoFaltante`, `type TipoEntidad`, `type Opcion` (Task 1), `crearEntidadesFaltantes` (ya existente), `confirmarImportacionCpeEnTanda`, `verificarCtgExistente` (Task 3), `type ResultadoImportacionCpe` (`@/lib/cpe/importar`, ya existente), `type CatalogosImportacionCpe` (Task 2).

- [ ] **Step 1: Agregar el checklist, el detalle expandible y el chequeo de CTG repetido**

Reemplazar el bloque `<ul>` de la lista de estado (del Task 5) por un checklist con acciones, y
sumar el manejo del detalle abierto, el `useForm` compartido para el detalle, y el chequeo de CTG.
El archivo completo queda así (reemplaza el contenido entero de `importador-masivo-cpe.tsx`):

```tsx
// src/app/(app)/viajes/importar-cpe-masivo/_componentes/importador-masivo-cpe.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";
import type { ResultadoImportacionCpe } from "@/lib/cpe/importar";
import { viajeDesdeCpeSchema, type ViajeDesdeCpeInput } from "@/lib/schemas/cpe-importacion";
import {
  agruparFaltantes,
  calcularHuellaFaltante,
  construirValoresIniciales,
  CamposRevisionCpe,
  DialogCrearRapido,
  type GrupoFaltante,
  type Opcion,
  type TipoEntidad,
} from "../../importar-cpe/_componentes/campos-revision-cpe";
import {
  confirmarImportacionCpeEnTanda,
  crearEntidadesFaltantes,
  importarCpe,
  verificarCtgExistente,
} from "../../importar-cpe/actions";

export type EstadoItem = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLote = {
  id: string;
  archivo: File;
  estado: EstadoItem;
  resultado: ResultadoImportacionCpe | null;
  error: string | null;
  viajeId: number | null;
  ctgDuplicadoEnLote: boolean;
  ctgYaExisteViajeNro: number | null;
};

const ETIQUETAS_ESTADO: Record<EstadoItem, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando...",
  listo: "Listo",
  revisar: "Revisar",
  error: "Error",
  confirmado: "Confirmado",
};

export function ImportadorMasivoCpe({
  clientes,
  camiones,
  choferes,
  productos,
  lugares,
  configDefaults,
}: CatalogosImportacionCpe) {
  const [items, setItems] = useState<ItemLote[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [idAbierto, setIdAbierto] = useState<string | null>(null);
  const [isPendingFaltantes, startTransitionFaltantes] = useTransition();
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

  const [dialog, setDialog] = useState<{
    tipo: TipoEntidad;
    titulo: string;
    nombre: string;
    extra: string;
    campo: Path<ViajeDesdeCpeInput>;
  } | null>(null);

  const form = useForm<ViajeDesdeCpeInput>({ resolver: zodResolver(viajeDesdeCpeSchema) });

  const itemAbierto = items.find((it) => it.id === idAbierto) ?? null;

  const todosListos = items.length > 0 && !procesando;
  const grupos = useMemo(
    () => agruparFaltantes(items.flatMap((it) => it.resultado?.faltantes ?? [])),
    [items]
  );

  function actualizarItem(id: string, cambios: Partial<ItemLote>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  function agregarOpcion(tipo: TipoEntidad, id: number, nombre: string) {
    const opcion = { value: String(id), label: nombre };
    const sumar = (prev: Opcion[]) =>
      prev.some((o) => o.value === opcion.value) ? prev : [...prev, opcion];
    if (tipo === "cliente") setOpcionesClientes(sumar);
    if (tipo === "camion") setOpcionesCamiones(sumar);
    if (tipo === "chofer") setOpcionesChoferes(sumar);
    if (tipo === "lugar") setOpcionesLugares(sumar);
    if (tipo === "producto") setOpcionesProductos(sumar);
  }

  async function procesarUno(item: ItemLote) {
    actualizarItem(item.id, { estado: "procesando" });
    try {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      const r = await importarCpe(formData);
      const necesitaRevision = r.motivoManual != null || r.extraido.campos_dudosos.length > 0;

      const ctg = r.extraido.ctg ?? r.referenciaQr;
      const viajesExistentes = ctg ? await verificarCtgExistente(ctg) : [];

      actualizarItem(item.id, {
        estado: necesitaRevision ? "revisar" : "listo",
        resultado: r,
        ctgYaExisteViajeNro: viajesExistentes[0]?.numero ?? null,
      });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      actualizarItem(item.id, { estado: "error", error: mensaje });
    }
  }

  async function onSeleccionarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    const nuevosItems: ItemLote[] = archivos.map((archivo) => ({
      id: crypto.randomUUID(),
      archivo,
      estado: "pendiente",
      resultado: null,
      error: null,
      viajeId: null,
      ctgDuplicadoEnLote: false,
      ctgYaExisteViajeNro: null,
    }));
    setItems(nuevosItems);
    setIdAbierto(null);
    e.target.value = "";

    setProcesando(true);
    for (const item of nuevosItems) {
      await procesarUno(item);
    }
    setProcesando(false);
  }

  // CTG repetido DENTRO del lote (además de contra la base, ya chequeado
  // por item en procesarUno): se recalcula acá porque depende de ver
  // todos los items juntos, no de uno solo.
  useEffect(() => {
    if (procesando) return;
    setItems((prev) => {
      const conteo = new Map<string, number>();
      for (const it of prev) {
        const ctg = it.resultado?.extraido.ctg ?? it.resultado?.referenciaQr;
        if (!ctg) continue;
        conteo.set(ctg, (conteo.get(ctg) ?? 0) + 1);
      }
      return prev.map((it) => {
        const ctg = it.resultado?.extraido.ctg ?? it.resultado?.referenciaQr;
        const duplicado = !!ctg && (conteo.get(ctg) ?? 0) > 1;
        return duplicado === it.ctgDuplicadoEnLote ? it : { ...it, ctgDuplicadoEnLote: duplicado };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesando]);

  function darDeAltaFaltantesGlobal() {
    startTransitionFaltantes(async () => {
      const faltantesConClavePrefijada = items.flatMap(
        (it) => it.resultado?.faltantes.map((f) => ({ ...f, clave: `${it.id}:${f.clave}` })) ?? []
      );
      if (faltantesConClavePrefijada.length === 0) return;

      const r = await crearEntidadesFaltantes({ faltantes: faltantesConClavePrefijada });
      if (r.error || !r.creadas) {
        toast.error(r.error ?? "No se pudieron dar de alta los registros.");
        return;
      }
      const creadas = r.creadas;

      for (const g of grupos) {
        for (const it of items) {
          const f = it.resultado?.faltantes.find((x) => calcularHuellaFaltante(x) === g.huella);
          const id = f ? creadas[`${it.id}:${f.clave}`] : undefined;
          if (id != null) {
            agregarOpcion(g.tipo, id, g.nombre);
            break;
          }
        }
      }

      setItems((prev) =>
        prev.map((it) => {
          if (!it.resultado) return it;
          const coincidencias = { ...it.resultado.coincidencias };
          const faltantesRestantes = it.resultado.faltantes.filter((f) => {
            const id = creadas[`${it.id}:${f.clave}`];
            if (id == null) return true;
            (coincidencias as Record<string, number | null>)[f.campo] = id;
            return false;
          });
          return { ...it, resultado: { ...it.resultado, coincidencias, faltantes: faltantesRestantes } };
        })
      );

      toast.success(
        grupos.length === 1 ? "Se dio de alta 1 registro." : `Se dieron de alta ${grupos.length} registros.`
      );
    });
  }

  function descartarFaltantesGlobal() {
    setItems((prev) =>
      prev.map((it) => (it.resultado ? { ...it, resultado: { ...it.resultado, faltantes: [] } } : it))
    );
  }

  function abrirDetalle(item: ItemLote) {
    if (!item.resultado) return;
    setIdAbierto(item.id);
    form.reset(construirValoresIniciales(item.resultado, clientes, configDefaults));
  }

  function cerrarDetalle() {
    setIdAbierto(null);
  }

  async function confirmarValores(itemId: string, valores: ViajeDesdeCpeInput) {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    startTransitionConfirmar(async () => {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      formData.set("datos", JSON.stringify(valores));
      const r = await confirmarImportacionCpeEnTanda(formData);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      actualizarItem(itemId, { estado: "confirmado", viajeId: r.viajeId });
      toast.success(`Viaje #${r.viajeId} creado.`);
      if (idAbierto === itemId) setIdAbierto(null);
    });
  }

  function confirmarRapido(item: ItemLote) {
    if (!item.resultado) return;
    const valores = construirValoresIniciales(item.resultado, clientes, configDefaults);
    confirmarValores(item.id, valores);
  }

  function abrirCrear(tipo: TipoEntidad, titulo: string, nombre: string, extra: string, campo: Path<ViajeDesdeCpeInput>) {
    setDialog({ tipo, titulo, nombre, extra, campo });
  }

  function onCreado(id: number, nombre: string) {
    if (!dialog || !itemAbierto) return;
    form.setValue(dialog.campo, id as never);
    agregarOpcion(dialog.tipo, id, nombre);
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemAbierto.id && it.resultado
          ? { ...it, resultado: { ...it.resultado, faltantes: it.resultado.faltantes.filter((f) => f.campo !== dialog.campo) } }
          : it
      )
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivos-cpe">Archivos o fotos de las CPE</Label>
          <Input
            id="archivos-cpe"
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            onChange={onSeleccionarArchivos}
            disabled={procesando}
          />
        </div>
      </div>

      {todosListos && grupos.length > 0 && (
        <div className="flex flex-col gap-3 rounded-md border border-amber/40 bg-amber/10 p-4">
          <div>
            <h3 className="text-sm font-bold">
              {grupos.length === 1 ? "Falta dar de alta 1 registro" : `Faltan dar de alta ${grupos.length} registros`}
            </h3>
            <p className="text-sm text-muted-foreground">
              Contando todos los archivos de esta tanda. Revisá que estén bien leídos y confirmá
              para crearlos y dejarlos asignados a los viajes que los necesitan.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {grupos.map((g: GrupoFaltante) => (
              <li key={g.huella} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md bg-card p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{g.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.documento && `${g.documento} · `}usar como {g.roles.join(", ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={darDeAltaFaltantesGlobal} disabled={isPendingFaltantes}>
              {isPendingFaltantes ? "Dando de alta..." : grupos.length === 1 ? "Dar de alta 1 registro" : `Dar de alta los ${grupos.length}`}
            </Button>
            <button type="button" onClick={descartarFaltantesGlobal} className="text-xs text-muted-foreground hover:underline">
              Los cargo a mano
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border p-4">
          <h3 className="text-sm font-bold">{items.length} archivo(s)</h3>
          <ul className="flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.id} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{it.archivo.name}</span>
                    {it.resultado && (
                      <span className="text-xs text-muted-foreground">
                        {it.resultado.extraido.pagador_nombre ?? "—"} · {it.resultado.extraido.chofer_nombre ?? "—"} ·{" "}
                        {it.resultado.extraido.dominio_tractor ?? "—"} · CTG {it.resultado.extraido.ctg ?? it.resultado.referenciaQr ?? "—"}
                      </span>
                    )}
                    {it.ctgDuplicadoEnLote && (
                      <span className="text-xs text-destructive">CTG repetido en esta misma tanda.</span>
                    )}
                    {it.ctgYaExisteViajeNro != null && (
                      <span className="text-xs text-destructive">
                        Ya existe el viaje #{it.ctgYaExisteViajeNro} con este CTG.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {ETIQUETAS_ESTADO[it.estado]}
                      {it.estado === "error" && it.error ? ` — ${it.error}` : ""}
                    </span>
                    {it.estado === "listo" && (
                      <Button size="sm" onClick={() => confirmarRapido(it)} disabled={isPendingConfirmar}>
                        Confirmar
                      </Button>
                    )}
                    {(it.estado === "listo" || it.estado === "revisar") && (
                      <Button size="sm" variant="outline" onClick={() => abrirDetalle(it)}>
                        Ver detalle
                      </Button>
                    )}
                    {it.estado === "error" && (
                      <Button size="sm" variant="outline" onClick={() => procesarUno(it)}>
                        Reintentar
                      </Button>
                    )}
                    {it.estado === "confirmado" && it.viajeId != null && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/viajes/${it.viajeId}`}>Ver viaje #{it.viajeId}</Link>
                      </Button>
                    )}
                  </div>
                </div>

                {idAbierto === it.id && it.resultado && (
                  <form
                    onSubmit={form.handleSubmit((valores) => confirmarValores(it.id, valores))}
                    className="flex flex-col gap-4 border-t pt-4"
                  >
                    <CamposRevisionCpe
                      form={form}
                      resultado={it.resultado}
                      grupos={[]}
                      isPendingFaltantes={false}
                      onDarDeAltaFaltantes={() => {}}
                      onDescartarFaltantes={() => {}}
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
                      <Button type="button" variant="outline" onClick={cerrarDetalle}>
                        Cerrar
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogCrearRapido dialog={dialog} onOpenChange={(v) => !v && setDialog(null)} onCreado={onCreado} />
    </div>
  );
}
```

Nota sobre `grupos={[]}` en el `<CamposRevisionCpe>` del detalle: el panel de faltantes de cada
fila ya no hace falta ahí porque se resuelve una sola vez, arriba, para toda la tanda -- si un
item todavía tiene faltantes sin resolver al momento de abrir su detalle (por ejemplo, si el
usuario nunca tocó "Dar de alta" en el panel global), esos campos igual quedan visibles y editables
en la grilla (los selects de Cliente/Chofer/Camión/etc. sencillamente aparecen vacíos para elegir a
mano), simplemente sin el panel de "+Nuevo con estos datos precargados" repetido por fila.

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores.

- [ ] **Step 3: Verificar en el navegador (local)**

En `/viajes/importar-cpe-masivo`, subir 2-3 archivos cualquiera. Confirmar que:
- Cada fila muestra su nombre de archivo y termina en algún estado (sin `ANTHROPIC_API_KEY`
  local, van a terminar en "Revisar", con motivoManual "sin_conexion_ia").
- "Ver detalle" abre el formulario completo con los campos vacíos (nada que la IA no pudo leer,
  esperable en local) y un botón "Cerrar" que lo colapsa sin romper nada.
- No hay errores de consola.

El chequeo completo (confirmar de verdad, ver que el viaje se crea, probar el panel de faltantes
y el aviso de CTG repetido) queda para el Task 9 contra producción.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/viajes/importar-cpe-masivo/_componentes/importador-masivo-cpe.tsx
git commit -m "Agrega el checklist de Importar CPE en tanda: confirmar, ver detalle y avisos de CTG"
```

---

### Task 8: Enlazar la pantalla nueva desde la navegación

**Files:**
- Modify: `src/app/(app)/viajes/page.tsx:82-84`
- Modify: `src/app/(app)/viajes/importar-cpe/page.tsx`

**Interfaces:** ninguna (solo JSX/links).

- [ ] **Step 1: Agregar el botón en el listado de Viajes**

En `src/app/(app)/viajes/page.tsx`, dentro del `<div className="flex flex-wrap gap-2">` que ya
tiene los botones de exportar/importar, agregar un botón nuevo justo después de "Importar CPE":

```tsx
<Button variant="outline" asChild>
  <Link href="/viajes/importar-cpe">Importar CPE</Link>
</Button>
<Button variant="outline" asChild>
  <Link href="/viajes/importar-cpe-masivo">Importar CPE (varios)</Link>
</Button>
```

- [ ] **Step 2: Agregar un enlace cruzado desde Importar CPE (una sola)**

En `src/app/(app)/viajes/importar-cpe/page.tsx`, agregar un link chico debajo de la descripción,
para quien entra ahí directo y en realidad tiene varios archivos para cargar:

```tsx
<div>
  <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar CPE</h1>
  <p className="text-sm text-muted-foreground">
    Subí el PDF o una foto de la Carta de Porte Electrónica: el sistema intenta completar los
    datos del viaje automáticamente, pero siempre revisás y confirmás antes de guardar nada.
  </p>
  <p className="text-sm text-muted-foreground">
    ¿Tenés varios archivos para cargar de una?{" "}
    <a href="/viajes/importar-cpe-masivo" className="text-primary underline">
      Importar CPE (varios)
    </a>
    .
  </p>
</div>
```

- [ ] **Step 2: Verificar tipos y en el navegador**

```bash
npx tsc --noEmit -p .
```

Confirmar en local que ambos links aparecen y navegan a `/viajes/importar-cpe-masivo`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/viajes/page.tsx src/app/\(app\)/viajes/importar-cpe/page.tsx
git commit -m "Enlaza Importar CPE (varios) desde el listado de viajes y desde Importar CPE"
```

---

### Task 9: Verificación de punta a punta en producción

**Files:** ninguno (solo verificación; puede generar commits de fix si algo falla).

- [ ] **Step 1: Deploy**

```bash
git push origin main
```

Confirmar el estado del deploy en Vercel vía `gh api repos/infosystuc-sys/transporte_df/commits/<sha>/status` como se viene haciendo en este proyecto, hasta ver `"state":"success"`.

- [ ] **Step 2: Probar con archivos reales, incluyendo un caso de error a propósito**

En `https://transporte-df.vercel.app/viajes/importar-cpe-masivo`, subir de una tanda:
- 2-3 CPE reales que ya se usaron en este proyecto para pruebas (ver archivos en
  `C:\Users\thomi\Downloads\`, ej. las `WhatsApp Image ...11.59.11.jpeg`).
- Un archivo que NO sea una CPE válida (por ejemplo, uno de los tickets de gasoil ya usados en
  otra sesión), para confirmar que ese ítem queda en "Revisar" (motivoManual) sin frenar a los
  demás -- o, si se quiere probar el camino de "Error" real, un archivo corrupto (ej. un `.txt`
  renombrado a `.pdf`).

Verificar:
- Los archivos se procesan en orden (no todos a la vez) y cada fila termina en el estado
  correcto.
- Si dos de los archivos comparten CTG (repetir uno a propósito), ambas filas muestran "CTG
  repetido en esta misma tanda."
- Si alguno de los CTG ya existe como viaje cargado (ver con una consulta directa a la base como
  se hizo en sesiones anteriores, o reutilizando un CTG ya sabido), la fila muestra el aviso "Ya
  existe el viaje #N con este CTG."
- Si hay clientes/choferes/camiones nuevos repetidos entre los archivos, el panel consolidado
  aparece una sola vez y "Dar de alta" los resuelve a todos.
- Confirmar al menos dos filas: una de un toque desde el checklist ("Confirmar"), otra abriendo
  "Ver detalle" primero. Confirmar en `/viajes` que ambos viajes quedaron creados con los datos
  correctos.

- [ ] **Step 3: Limpiar los viajes de prueba creados**

Igual que en sesiones anteriores de este proyecto: borrar por SQL directo los viajes creados
durante esta verificación (y cualquier fila dependiente: adjuntos, etc.) para no dejar datos de
prueba en producción, siguiendo el mismo patrón usado antes en este proyecto (transacción SQL con
`postgres` contra `DATABASE_URL` de `.env.local`, nunca contra datos reales del cliente).

- [ ] **Step 4: Reportar resultado**

Si algo falló, volver al task correspondiente, corregir, repetir el deploy y la verificación. Si
todo salió bien, la funcionalidad queda lista para que el cliente la use con sus archivos reales.
