# Importar descarga en tanda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir subir varios tickets de balanza/notas de recepción de una sola vez y actualizar la descarga de cada viaje encontrado desde un checklist, sin repetir el ciclo completo de subir→buscar→revisar→confirmar→volver por cada uno.

**Architecture:** Página nueva (`/viajes/importar-descarga-masivo`) que reutiliza toda la lógica existente de lectura/matching por CTG y de guardado (`previsualizarImportacionDescarga`, `actualizarDescargaConAdjunto` — ninguna de las dos cambia de firma ni de comportamiento). Los archivos se procesan secuencialmente en el cliente. El formulario de campos editables de descarga (y el selector cuando el CTG matchea a varios viajes) se extraen a un componente compartido para no duplicarlos entre la pantalla de un solo archivo y el detalle de cada fila de la tanda. A diferencia de la tanda de CPE, acá no hace falta ninguna acción de servidor nueva: `actualizarDescargaConAdjunto` ya no redirige hoy, así que sirve tal cual para confirmar una fila sin salir del checklist.

**Tech Stack:** Next.js 16 App Router (Server Actions), React Hook Form + Zod, Drizzle ORM/Postgres, TypeScript. Sin framework de tests en el proyecto — verificación manual (`tsc`/`eslint` en cada tarea, prueba real en producción al final), mismo patrón que el plan de Importar CPE en tanda (`docs/superpowers/plans/2026-08-28-importar-cpe-masivo.md`).

## Global Constraints

- No se toca el comportamiento de `/viajes/importar-descarga` (un solo archivo): debe funcionar exactamente igual que hoy después de cada tarea de refactor.
- `viajeDescargaSchema` (`src/lib/schemas/viajes.ts:57-69`) no tiene NINGÚN campo obligatorio (todos son `*Opcional`) — a diferencia de la tanda de CPE, acá no hay riesgo de que confirmar de un toque tire un error de validación por un campo faltante. No hace falta ningún guard de `safeParse` antes de confirmar por esta razón (si se agrega manejo de errores igual, es solo por robustez general, no por este riesgo puntual).
- No hay `ANTHROPIC_API_KEY` en `.env.local` — cualquier verificación que dependa de la lectura real por IA se hace contra producción, nunca contra el servidor local.
- Seguir el estilo de comentarios del proyecto: sin comentarios que expliquen "qué" hace el código, solo el "por qué" cuando no es obvio.
- Todo archivo nuevo bajo `src/app/(app)/viajes/importar-descarga-masivo/` sigue la convención de carpetas ya usada (`page.tsx` + `_componentes/`).

---

### Task 1: Extraer los campos de revisión de descarga a un componente compartido

**Files:**
- Create: `src/app/(app)/viajes/importar-descarga/_componentes/campos-revision-descarga.tsx`
- Modify: `src/app/(app)/viajes/importar-descarga/_componentes/formulario-importar-descarga.tsx`

**Interfaces:**
- Produces (usado por Task 5): `PickerViajesEncontrados` (componente), `CamposRevisionDescarga` (componente), `construirValoresDescarga(datos: ComprobanteDescargaExtraido): ViajeDescargaInput`, `ETIQUETAS_ESTADO: Record<string,string>`, `ETIQUETAS_CAMPOS_DESCARGA: Record<string,string>`.

Refactor puro: mueve código existente (verbatim) a un archivo nuevo y lo importa desde donde vivía. No cambia ningún comportamiento visible.

- [ ] **Step 1: Crear el archivo compartido**

Crear `src/app/(app)/viajes/importar-descarga/_componentes/campos-revision-descarga.tsx`:

```tsx
"use client";

import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CampoPeso, CampoTexto } from "@/components/catalogos/campos-formulario";
import type { UseFormReturn } from "react-hook-form";
import type { ViajeDescargaInput } from "@/lib/schemas/viajes";
import type { ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import type { ViajeEncontradoPorCtg } from "../../_lib/buscar-ctg";

export const ETIQUETAS_CAMPOS_DESCARGA: Record<string, string> = {
  ctg: "CTG",
  n_turno_descarga: "N° de turno",
  bruto_destino_kg: "Peso bruto (destino)",
  tara_destino_kg: "Tara (destino)",
  neto_destino_kg: "Peso neto (destino)",
  humedad_pct: "Humedad (%)",
};

export const ETIQUETAS_ESTADO: Record<string, string> = {
  planificado: "Planificado",
  cargado: "Cargado",
  en_transito: "En tránsito",
  descargado: "Descargado",
  facturado: "Facturado",
  cobrado: "Cobrado",
  liquidado: "Liquidado",
  rechazado: "Rechazado",
};

const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

export function construirValoresDescarga(datos: ComprobanteDescargaExtraido): ViajeDescargaInput {
  return {
    fecha_arribo: (datos.fecha_arribo ?? undefined) as unknown as Date,
    fecha_descarga: (datos.fecha_descarga ?? undefined) as unknown as Date,
    n_turno_descarga: datos.n_turno_descarga ?? "",
    bruto_destino: datos.bruto_destino_kg != null ? String(datos.bruto_destino_kg) : "",
    tara_destino: datos.tara_destino_kg != null ? String(datos.tara_destino_kg) : "",
    neto_destino: datos.neto_destino_kg != null ? String(datos.neto_destino_kg) : "",
    humedad_pct: datos.humedad_pct != null ? String(datos.humedad_pct) : "",
    merma_precio_unitario: "",
  };
}

/** Lista para elegir a mano cuando el CTG matchea a más de un viaje cargado. */
export function PickerViajesEncontrados({
  viajes,
  ctgBuscado,
  onElegir,
}: {
  viajes: ViajeEncontradoPorCtg[];
  ctgBuscado: string | null;
  onElegir: (viaje: ViajeEncontradoPorCtg) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <p className="text-sm text-muted-foreground">
        Encontré {viajes.length} viajes con el CTG {ctgBuscado}. Elegí cuál es:
      </p>
      <div className="flex flex-col gap-2">
        {viajes.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onElegir(v)}
            className="flex items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted"
          >
            <span>
              #{v.numero} — {v.cliente_nombre ?? "—"} — {v.chofer_nombre ?? "—"} —{" "}
              {v.dominio_tractor ?? "—"}
            </span>
            <span className="text-muted-foreground">{ETIQUETAS_ESTADO[v.estado] ?? v.estado}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * El viaje encontrado, el aviso de campos dudosos, el aviso de
 * sobrescritura (si ya tenía descarga cargada) y la grilla de campos
 * editables. No incluye el <form> que lo envuelve ni el botón de
 * confirmar -- eso lo maneja cada pantalla que lo usa (la de un solo
 * archivo y, más adelante, el detalle de cada fila de la tanda).
 */
export function CamposRevisionDescarga({
  form,
  viaje,
  datosExtraidos,
  confirmaSobrescribir,
  onConfirmaSobrescribirChange,
}: {
  form: UseFormReturn<ViajeDescargaInput>;
  viaje: ViajeEncontradoPorCtg;
  datosExtraidos: ComprobanteDescargaExtraido;
  confirmaSobrescribir: boolean;
  onConfirmaSobrescribirChange: (v: boolean) => void;
}) {
  const yaTieneDescarga = !!viaje.fecha_descarga;

  return (
    <>
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        <p className="font-semibold">
          Viaje #{viaje.numero} — CTG {viaje.ctg}
        </p>
        <p className="text-muted-foreground">
          {viaje.cliente_nombre ?? "—"} · Chofer: {viaje.chofer_nombre ?? "—"} · Camión:{" "}
          {viaje.dominio_tractor ?? "—"} · {ETIQUETAS_ESTADO[viaje.estado] ?? viaje.estado}
        </p>
      </div>

      {datosExtraidos.campos_dudosos.length > 0 && (
        <p className="rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
          La IA no está segura de estos campos (foto poco clara en esa zona) — revisalos con más
          atención: {datosExtraidos.campos_dudosos.map((c) => ETIQUETAS_CAMPOS_DESCARGA[c] ?? c).join(", ")}.
        </p>
      )}

      {yaTieneDescarga && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Este viaje ya tiene datos de descarga cargados</AlertTitle>
          <AlertDescription>
            Fecha de descarga actual:{" "}
            {viaje.fecha_descarga ? formatoFecha.format(viaje.fecha_descarga) : "—"}. Si continuás,
            se van a reemplazar por los datos de abajo.
            <label className="mt-2 flex items-center gap-2">
              <Checkbox
                checked={confirmaSobrescribir}
                onCheckedChange={(v) => onConfirmaSobrescribirChange(!!v)}
              />
              Sí, quiero sobrescribir los datos de descarga existentes.
            </label>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoTexto form={form} name="fecha_arribo" label="Fecha de arribo" tipo="date" />
        <CampoTexto form={form} name="fecha_descarga" label="Fecha de descarga" tipo="date" />
        <CampoTexto form={form} name="n_turno_descarga" label="N° de turno" />
        <CampoPeso form={form} name="bruto_destino" label="Peso bruto (destino)" />
        <CampoPeso form={form} name="tara_destino" label="Tara (destino)" />
        <CampoPeso form={form} name="neto_destino" label="Peso neto (destino)" />
        <CampoTexto form={form} name="humedad_pct" label="Humedad (%)" />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Reescribir `formulario-importar-descarga.tsx` para usar el componente compartido**

Reemplazar todo el contenido de `src/app/(app)/viajes/importar-descarga/_componentes/formulario-importar-descarga.tsx` por:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { viajeDescargaSchema, type ViajeDescargaInput } from "@/lib/schemas/viajes";
import type { ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import type { ViajeEncontradoPorCtg } from "../../_lib/buscar-ctg";
import { actualizarDescargaConAdjunto } from "../../actions";
import { previsualizarImportacionDescarga } from "../actions";
import {
  CamposRevisionDescarga,
  construirValoresDescarga,
  PickerViajesEncontrados,
} from "./campos-revision-descarga";

const valoresPorDefecto: ViajeDescargaInput = {
  fecha_arribo: undefined,
  fecha_descarga: undefined,
  n_turno_descarga: "",
  bruto_destino: "",
  tara_destino: "",
  neto_destino: "",
  humedad_pct: "",
  merma_precio_unitario: "",
};

export function FormularioImportarDescarga() {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [isPendingProcesar, startTransitionProcesar] = useTransition();
  const [isPendingGuardar, startTransitionGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ctgBuscado, setCtgBuscado] = useState<string | null>(null);
  const [viajesEncontrados, setViajesEncontrados] = useState<ViajeEncontradoPorCtg[] | null>(null);
  const [datosExtraidos, setDatosExtraidos] = useState<ComprobanteDescargaExtraido | null>(null);
  const [viajeElegido, setViajeElegido] = useState<ViajeEncontradoPorCtg | null>(null);
  const [confirmaSobrescribir, setConfirmaSobrescribir] = useState(false);

  const form = useForm<ViajeDescargaInput>({
    resolver: zodResolver(viajeDescargaSchema),
    defaultValues: valoresPorDefecto,
  });

  function onSeleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    setArchivo(e.target.files?.[0] ?? null);
    setError(null);
    setViajesEncontrados(null);
    setDatosExtraidos(null);
    setViajeElegido(null);
  }

  function procesar() {
    if (!archivo) return;
    setError(null);
    setViajesEncontrados(null);
    setDatosExtraidos(null);
    setViajeElegido(null);
    startTransitionProcesar(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const resultado = await previsualizarImportacionDescarga(formData);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setCtgBuscado(resultado.datos.ctg);
      setViajesEncontrados(resultado.viajes);
      setDatosExtraidos(resultado.datos);
      if (resultado.viajes.length === 0) {
        setError(`No se encontró ningún viaje cargado con el CTG ${resultado.datos.ctg}.`);
        return;
      }
      if (resultado.viajes.length === 1) {
        elegirViaje(resultado.viajes[0], resultado.datos);
      }
    });
  }

  function elegirViaje(viaje: ViajeEncontradoPorCtg, datos: ComprobanteDescargaExtraido) {
    setViajeElegido(viaje);
    setConfirmaSobrescribir(false);
    form.reset(construirValoresDescarga(datos));
  }

  const yaTieneDescarga = !!viajeElegido?.fecha_descarga;

  function onSubmit(valores: ViajeDescargaInput) {
    if (!viajeElegido || !archivo) return;
    if (yaTieneDescarga && !confirmaSobrescribir) {
      toast.error("Confirmá el checkbox de sobrescritura antes de guardar.");
      return;
    }
    startTransitionGuardar(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      formData.set("datos", JSON.stringify(valores));
      const resultado = await actualizarDescargaConAdjunto(viajeElegido.id, formData);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Descarga cargada.");
      router.push(`/viajes/${viajeElegido.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivo-descarga">Ticket de balanza o nota de recepción</Label>
          <Input
            id="archivo-descarga"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            onChange={onSeleccionarArchivo}
          />
        </div>
        <div>
          <Button onClick={procesar} disabled={!archivo || isPendingProcesar}>
            {isPendingProcesar ? "Leyendo..." : "Buscar viaje por CTG"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>No se pudo continuar</AlertTitle>
          <AlertDescription>
            {error}{" "}
            {ctgBuscado && (
              <>
                Buscá el viaje a mano en{" "}
                <Link href={`/viajes?q=${encodeURIComponent(ctgBuscado)}`} className="underline">
                  el listado de Viajes
                </Link>
                , o{" "}
                <Link href="/viajes" className="underline">
                  entrá directamente
                </Link>{" "}
                y cargá la descarga desde la pestaña correspondiente.
              </>
            )}
            {!ctgBuscado && (
              <>
                {" "}
                Podés cargar la descarga a mano desde{" "}
                <Link href="/viajes" className="underline">
                  el listado de Viajes
                </Link>
                .
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {viajesEncontrados && viajesEncontrados.length > 1 && !viajeElegido && (
        <PickerViajesEncontrados
          viajes={viajesEncontrados}
          ctgBuscado={ctgBuscado}
          onElegir={(v) => datosExtraidos && elegirViaje(v, datosExtraidos)}
        />
      )}

      {viajeElegido && datosExtraidos && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <CamposRevisionDescarga
            form={form}
            viaje={viajeElegido}
            datosExtraidos={datosExtraidos}
            confirmaSobrescribir={confirmaSobrescribir}
            onConfirmaSobrescribirChange={setConfirmaSobrescribir}
          />
          <div>
            <Button type="submit" disabled={isPendingGuardar || (yaTieneDescarga && !confirmaSobrescribir)}>
              {isPendingGuardar ? "Guardando..." : "Confirmar y cargar descarga"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores.

- [ ] **Step 4: Verificar en el navegador que la pantalla de un solo archivo sigue igual**

Arrancar el server local, entrar a `/viajes/importar-descarga`, confirmar que la pantalla se ve y comporta igual que antes del refactor (input de archivo, botón "Buscar viaje por CTG"). Sin `ANTHROPIC_API_KEY` local no se puede completar el flujo entero -- alcanza con confirmar que no hay errores de consola y el layout no se rompió.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/viajes/importar-descarga/_componentes/campos-revision-descarga.tsx" "src/app/(app)/viajes/importar-descarga/_componentes/formulario-importar-descarga.tsx"
git commit -m "Extrae los campos de revision de descarga a un componente compartido"
```

---

### Task 2: Página nueva `/viajes/importar-descarga-masivo` (esqueleto)

**Files:**
- Create: `src/app/(app)/viajes/importar-descarga-masivo/page.tsx`
- Create: `src/app/(app)/viajes/importar-descarga-masivo/_componentes/importador-masivo-descarga.tsx` (esqueleto vacío, se completa en Tasks 3-4)

**Interfaces:** ninguna nueva -- no hace falta ningún dato de servidor para esta página (a diferencia de la de CPE, acá no hay catálogos que precargar).

- [ ] **Step 1: Crear la página**

```tsx
// src/app/(app)/viajes/importar-descarga-masivo/page.tsx
import type { Metadata } from "next";
import { ImportadorMasivoDescarga } from "./_componentes/importador-masivo-descarga";

export const metadata: Metadata = {
  title: "Importar descarga (varios) — Gestión de Fletes",
};

export default function ImportarDescargaMasivoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar descarga (varios)</h1>
        <p className="text-sm text-muted-foreground">
          Subí varios tickets de balanza o notas de recepción de una: la app va buscando el viaje de
          cada uno por CTG y te deja confirmar sin salir de esta pantalla.
        </p>
      </div>
      <ImportadorMasivoDescarga />
    </div>
  );
}
```

- [ ] **Step 2: Crear el esqueleto del componente cliente**

```tsx
// src/app/(app)/viajes/importar-descarga-masivo/_componentes/importador-masivo-descarga.tsx
"use client";

export function ImportadorMasivoDescarga() {
  return <p className="text-sm text-muted-foreground">Próximamente.</p>;
}
```

- [ ] **Step 3: Verificar tipos y en el navegador**

```bash
npx tsc --noEmit -p .
```

Confirmar en local que `/viajes/importar-descarga-masivo` carga el título y "Próximamente." sin errores de consola.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/viajes/importar-descarga-masivo/
git commit -m "Agrega la ruta de Importar descarga en tanda (esqueleto)"
```

---

### Task 3: Selección de varios archivos y procesamiento secuencial

**Files:**
- Modify: `src/app/(app)/viajes/importar-descarga-masivo/_componentes/importador-masivo-descarga.tsx`

**Interfaces:**
- Consumes: `previsualizarImportacionDescarga(formData: FormData): Promise<{ok:true; viajes: ViajeEncontradoPorCtg[]; datos: ComprobanteDescargaExtraido} | {ok:false; error:string}>` (de `../../importar-descarga/actions`, ya existe).
- Produces (usado por Task 4): tipo `ItemLoteDescarga`, `type EstadoItemDescarga`.

- [ ] **Step 1: Implementar el estado por archivo y el procesamiento secuencial**

```tsx
// src/app/(app)/viajes/importar-descarga-masivo/_componentes/importador-masivo-descarga.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import type { ViajeEncontradoPorCtg } from "../../_lib/buscar-ctg";
import { previsualizarImportacionDescarga } from "../../importar-descarga/actions";

export type EstadoItemDescarga = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLoteDescarga = {
  id: string;
  archivo: File;
  estado: EstadoItemDescarga;
  ctgBuscado: string | null;
  viajesEncontrados: ViajeEncontradoPorCtg[] | null;
  datosExtraidos: ComprobanteDescargaExtraido | null;
  /** Único candidato resuelto -- null si no se encontró ninguno o si hay más de uno sin elegir. */
  viajeElegido: ViajeEncontradoPorCtg | null;
  error: string | null;
};

const ETIQUETAS_ESTADO_ITEM: Record<EstadoItemDescarga, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando...",
  listo: "Listo",
  revisar: "Revisar",
  error: "Error",
  confirmado: "Confirmado",
};

export function ImportadorMasivoDescarga() {
  const [items, setItems] = useState<ItemLoteDescarga[]>([]);
  const [procesando, setProcesando] = useState(false);

  function actualizarItem(id: string, cambios: Partial<ItemLoteDescarga>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  async function procesarUno(item: ItemLoteDescarga) {
    actualizarItem(item.id, { estado: "procesando" });
    const formData = new FormData();
    formData.set("archivo", item.archivo);
    const r = await previsualizarImportacionDescarga(formData);
    if (!r.ok) {
      actualizarItem(item.id, { estado: "error", error: r.error });
      return;
    }
    const viajeUnico = r.viajes.length === 1 ? r.viajes[0] : null;
    const yaTieneDescarga = !!viajeUnico?.fecha_descarga;
    // Igual que en la tanda de CPE: nunca se ofrece confirmar de un toque
    // si hay algo para revisar a mano -- acá eso incluye no encontrar el
    // viaje, encontrar más de uno, o que ya tenga descarga cargada (nunca
    // sobrescribir a ciegas).
    const necesitaRevision =
      !viajeUnico || yaTieneDescarga || r.datos.campos_dudosos.length > 0;
    actualizarItem(item.id, {
      estado: necesitaRevision ? "revisar" : "listo",
      ctgBuscado: r.datos.ctg,
      viajesEncontrados: r.viajes,
      datosExtraidos: r.datos,
      viajeElegido: viajeUnico,
    });
  }

  async function onSeleccionarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    const nuevosItems: ItemLoteDescarga[] = archivos.map((archivo) => ({
      id: crypto.randomUUID(),
      archivo,
      estado: "pendiente",
      ctgBuscado: null,
      viajesEncontrados: null,
      datosExtraidos: null,
      viajeElegido: null,
      error: null,
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
          <Label htmlFor="archivos-descarga">Tickets de balanza o notas de recepción</Label>
          <Input
            id="archivos-descarga"
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
          <h3 className="text-sm font-bold">{items.length} archivo(s)</h3>
          <ul className="flex flex-col gap-1">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{it.archivo.name}</span>
                <span className="text-muted-foreground">
                  {ETIQUETAS_ESTADO_ITEM[it.estado]}
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

En `/viajes/importar-descarga-masivo`, seleccionar 2-3 archivos cualquiera. Sin `ANTHROPIC_API_KEY` local, `previsualizarImportacionDescarga` va a devolver `{ok:false, error: "No se pudo leer el comprobante automáticamente..."}` para cada uno (ver `MENSAJE_NO_LEIDO` en `importar-descarga/actions.ts`) -- confirmar que cada fila termina en "Error" con ese mensaje, EN ORDEN (no todas a la vez), y que no hay errores de consola.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/viajes/importar-descarga-masivo/_componentes/importador-masivo-descarga.tsx
git commit -m "Procesa varios tickets de descarga secuencialmente con estado por archivo"
```

---

### Task 4: Checklist con confirmar/ver detalle, y aviso de viaje repetido en la tanda

**Files:**
- Modify: `src/app/(app)/viajes/importar-descarga-masivo/_componentes/importador-masivo-descarga.tsx`

**Interfaces:**
- Consumes: `CamposRevisionDescarga`, `PickerViajesEncontrados`, `construirValoresDescarga`, `ETIQUETAS_ESTADO` (Task 1), `actualizarDescargaConAdjunto` (de `../../actions`, ya existe, sin cambios de firma).

- [ ] **Step 1: Agregar el checklist, el detalle expandible y el aviso de viaje repetido**

Reemplazar el contenido entero de `importador-masivo-descarga.tsx` por:

```tsx
// src/app/(app)/viajes/importar-descarga-masivo/_componentes/importador-masivo-descarga.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { viajeDescargaSchema, type ViajeDescargaInput } from "@/lib/schemas/viajes";
import type { ComprobanteDescargaExtraido } from "@/lib/comprobantes/claude-descarga";
import type { ViajeEncontradoPorCtg } from "../../_lib/buscar-ctg";
import { actualizarDescargaConAdjunto } from "../../actions";
import { previsualizarImportacionDescarga } from "../../importar-descarga/actions";
import {
  CamposRevisionDescarga,
  construirValoresDescarga,
  ETIQUETAS_ESTADO,
  PickerViajesEncontrados,
} from "../../importar-descarga/_componentes/campos-revision-descarga";

export type EstadoItemDescarga = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLoteDescarga = {
  id: string;
  archivo: File;
  estado: EstadoItemDescarga;
  ctgBuscado: string | null;
  viajesEncontrados: ViajeEncontradoPorCtg[] | null;
  datosExtraidos: ComprobanteDescargaExtraido | null;
  viajeElegido: ViajeEncontradoPorCtg | null;
  error: string | null;
};

const ETIQUETAS_ESTADO_ITEM: Record<EstadoItemDescarga, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando...",
  listo: "Listo",
  revisar: "Revisar",
  error: "Error",
  confirmado: "Confirmado",
};

export function ImportadorMasivoDescarga() {
  const [items, setItems] = useState<ItemLoteDescarga[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [idAbierto, setIdAbierto] = useState<string | null>(null);
  const [confirmaSobrescribir, setConfirmaSobrescribir] = useState(false);
  const [isPendingConfirmar, startTransitionConfirmar] = useTransition();

  const itemAbierto = items.find((it) => it.id === idAbierto) ?? null;

  const form = useForm<ViajeDescargaInput>({ resolver: zodResolver(viajeDescargaSchema) });

  // Mismo criterio que el CTG repetido en la tanda de CPE: dos archivos
  // de esta tanda pueden resolver al mismo viaje (ticket subido dos
  // veces, o dos fotos del mismo ticket) -- se avisa, no se bloquea.
  const viajeIdsRepetidosEnLote = useMemo(() => {
    const conteo = new Map<number, number>();
    for (const it of items) {
      if (it.viajeElegido) conteo.set(it.viajeElegido.id, (conteo.get(it.viajeElegido.id) ?? 0) + 1);
    }
    return new Set([...conteo.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [items]);

  function actualizarItem(id: string, cambios: Partial<ItemLoteDescarga>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  async function procesarUno(item: ItemLoteDescarga) {
    actualizarItem(item.id, { estado: "procesando", error: null });
    const formData = new FormData();
    formData.set("archivo", item.archivo);
    const r = await previsualizarImportacionDescarga(formData);
    if (!r.ok) {
      actualizarItem(item.id, { estado: "error", error: r.error });
      return;
    }
    const viajeUnico = r.viajes.length === 1 ? r.viajes[0] : null;
    const yaTieneDescarga = !!viajeUnico?.fecha_descarga;
    const necesitaRevision = !viajeUnico || yaTieneDescarga || r.datos.campos_dudosos.length > 0;
    actualizarItem(item.id, {
      estado: necesitaRevision ? "revisar" : "listo",
      ctgBuscado: r.datos.ctg,
      viajesEncontrados: r.viajes,
      datosExtraidos: r.datos,
      viajeElegido: viajeUnico,
    });
  }

  async function onSeleccionarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    const nuevosItems: ItemLoteDescarga[] = archivos.map((archivo) => ({
      id: crypto.randomUUID(),
      archivo,
      estado: "pendiente",
      ctgBuscado: null,
      viajesEncontrados: null,
      datosExtraidos: null,
      viajeElegido: null,
      error: null,
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

  function abrirDetalle(item: ItemLoteDescarga) {
    setIdAbierto(item.id);
    setConfirmaSobrescribir(false);
    if (item.viajeElegido && item.datosExtraidos) {
      form.reset(construirValoresDescarga(item.datosExtraidos));
    }
  }

  function cerrarDetalle() {
    setIdAbierto(null);
  }

  function elegirViajeEnDetalle(itemId: string, viaje: ViajeEncontradoPorCtg) {
    const item = items.find((it) => it.id === itemId);
    if (!item?.datosExtraidos) return;
    actualizarItem(itemId, { viajeElegido: viaje });
    setConfirmaSobrescribir(false);
    form.reset(construirValoresDescarga(item.datosExtraidos));
  }

  async function confirmarValores(itemId: string, valores: ViajeDescargaInput) {
    const item = items.find((it) => it.id === itemId);
    if (!item?.viajeElegido) return;
    if (item.viajeElegido.fecha_descarga && !confirmaSobrescribir) {
      toast.error("Confirmá el checkbox de sobrescritura antes de guardar.");
      return;
    }
    startTransitionConfirmar(async () => {
      try {
        const formData = new FormData();
        formData.set("archivo", item.archivo);
        formData.set("datos", JSON.stringify(valores));
        const r = await actualizarDescargaConAdjunto(item.viajeElegido!.id, formData);
        if (r?.error) {
          toast.error(r.error);
          return;
        }
        actualizarItem(itemId, { estado: "confirmado" });
        toast.success(`Descarga cargada en el viaje #${item.viajeElegido!.numero}.`);
        if (idAbierto === itemId) setIdAbierto(null);
      } catch (err) {
        console.error("actualizarDescargaConAdjunto falló:", err);
        const mensaje = err instanceof Error ? err.message : String(err);
        toast.error(`No se pudo cargar la descarga: ${mensaje}`);
      }
    });
  }

  function confirmarRapido(item: ItemLoteDescarga) {
    if (!item.viajeElegido || !item.datosExtraidos) return;
    confirmarValores(item.id, construirValoresDescarga(item.datosExtraidos));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivos-descarga">Tickets de balanza o notas de recepción</Label>
          <Input
            id="archivos-descarga"
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
          <h3 className="text-sm font-bold">{items.length} archivo(s)</h3>
          <ul className="flex flex-col gap-2">
            {items.map((it) => {
              const repetido = !!it.viajeElegido && viajeIdsRepetidosEnLote.has(it.viajeElegido.id);
              return (
                <li key={it.id} className="flex flex-col gap-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{it.archivo.name}</span>
                      {it.viajeElegido && (
                        <span className="text-xs text-muted-foreground">
                          Viaje #{it.viajeElegido.numero} · {it.viajeElegido.cliente_nombre ?? "—"} ·
                          CTG {it.viajeElegido.ctg}
                        </span>
                      )}
                      {repetido && (
                        <span className="text-xs text-destructive">
                          Otro archivo de esta tanda también apunta a este viaje.
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {ETIQUETAS_ESTADO_ITEM[it.estado]}
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
                      {it.estado === "confirmado" && it.viajeElegido && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/viajes/${it.viajeElegido.id}`}>Ver viaje #{it.viajeElegido.numero}</Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {idAbierto === it.id && (
                    <div className="flex flex-col gap-4 border-t pt-4">
                      {it.viajesEncontrados && it.viajesEncontrados.length > 1 && !it.viajeElegido && (
                        <PickerViajesEncontrados
                          viajes={it.viajesEncontrados}
                          ctgBuscado={it.ctgBuscado}
                          onElegir={(v) => elegirViajeEnDetalle(it.id, v)}
                        />
                      )}
                      {!it.viajesEncontrados?.length && (
                        <p className="text-sm text-muted-foreground">
                          {it.ctgBuscado
                            ? `No se encontró ningún viaje cargado con el CTG ${it.ctgBuscado}. Buscalo a mano en `
                            : "No se pudo leer el CTG de este archivo. Buscá el viaje a mano en "}
                          <Link href="/viajes" className="underline">
                            el listado de Viajes
                          </Link>
                          .
                        </p>
                      )}
                      {it.viajeElegido && it.datosExtraidos && (
                        <form
                          onSubmit={form.handleSubmit((valores) => confirmarValores(it.id, valores))}
                          className="flex flex-col gap-4"
                        >
                          <CamposRevisionDescarga
                            form={form}
                            viaje={it.viajeElegido}
                            datosExtraidos={it.datosExtraidos}
                            confirmaSobrescribir={confirmaSobrescribir}
                            onConfirmaSobrescribirChange={setConfirmaSobrescribir}
                          />
                          <div className="flex gap-3">
                            <Button
                              type="submit"
                              disabled={
                                isPendingConfirmar ||
                                (!!it.viajeElegido.fecha_descarga && !confirmaSobrescribir)
                              }
                            >
                              {isPendingConfirmar ? "Guardando..." : "Confirmar y cargar descarga"}
                            </Button>
                            <Button type="button" variant="outline" onClick={cerrarDetalle}>
                              Cerrar
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
```

Nota sobre `ETIQUETAS_ESTADO_ITEM` vs `ETIQUETAS_ESTADO`: son dos cosas distintas a propósito -- `ETIQUETAS_ESTADO` (importado del componente compartido) traduce el **estado del viaje** (planificado/cargado/etc.), `ETIQUETAS_ESTADO_ITEM` (local a este archivo) traduce el **estado de la fila en la tanda** (pendiente/procesando/listo/etc.). No unificar ni renombrar para que coincidan -- son conceptos diferentes que conviven en la misma pantalla.

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores.

- [ ] **Step 3: Verificar en el navegador (local)**

En `/viajes/importar-descarga-masivo`, subir 2-3 archivos cualquiera. Sin `ANTHROPIC_API_KEY` local van a terminar todos en "Error" (mismo comportamiento que Task 3) -- confirmar que "Reintentar" funciona (vuelve a poner esa fila en "Procesando..." y después otra vez en "Error"), y que no hay errores de consola. El chequeo completo (CTG ambiguo, sobrescritura, viaje repetido, confirmar de verdad) queda para el Task 6 contra producción.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/viajes/importar-descarga-masivo/_componentes/importador-masivo-descarga.tsx
git commit -m "Agrega el checklist de Importar descarga en tanda: confirmar, ver detalle y aviso de viaje repetido"
```

---

### Task 5: Enlazar la pantalla nueva desde la navegación

**Files:**
- Modify: `src/app/(app)/viajes/page.tsx`
- Modify: `src/app/(app)/viajes/importar-descarga/page.tsx`

**Interfaces:** ninguna (solo JSX/links).

- [ ] **Step 1: Agregar el botón en el listado de Viajes**

En `src/app/(app)/viajes/page.tsx`, dentro del `<div className="flex flex-wrap gap-2">` que ya tiene los botones de importar, agregar un botón nuevo justo después de "Importar descarga":

```tsx
<Button variant="outline" asChild>
  <Link href="/viajes/importar-descarga">Importar descarga</Link>
</Button>
<Button variant="outline" asChild>
  <Link href="/viajes/importar-descarga-masivo">Importar descarga (varios)</Link>
</Button>
```

- [ ] **Step 2: Agregar un enlace cruzado desde Importar descarga (una sola)**

En `src/app/(app)/viajes/importar-descarga/page.tsx`, agregar un import de `Link` de `next/link` y un párrafo debajo de la descripción:

```tsx
import Link from "next/link";
```

```tsx
<div>
  <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar descarga</h1>
  <p className="text-sm text-muted-foreground">
    Subí el ticket de balanza o la nota de recepción del destino: el sistema lee el CTG,
    busca el viaje que ya tenés cargado con ese CTG, y precarga los datos de descarga para
    que los revises antes de confirmar.
  </p>
  <p className="text-sm text-muted-foreground">
    ¿Tenés varios archivos para cargar de una?{" "}
    <Link href="/viajes/importar-descarga-masivo" className="text-primary underline">
      Importar descarga (varios)
    </Link>
    .
  </p>
</div>
```

- [ ] **Step 3: Verificar tipos y en el navegador**

```bash
npx tsc --noEmit -p .
```

Confirmar en local que ambos links aparecen y navegan a `/viajes/importar-descarga-masivo`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/viajes/page.tsx src/app/\(app\)/viajes/importar-descarga/page.tsx
git commit -m "Enlaza Importar descarga (varios) desde el listado de viajes y desde Importar descarga"
```

---

### Task 6: Verificación de punta a punta en producción

**Files:** ninguno (solo verificación; puede generar commits de fix si algo falla).

- [ ] **Step 1: Deploy**

```bash
git push origin main
```

Confirmar el estado del deploy vía `gh api repos/infosystuc-sys/transporte_df/commits/<sha>/status` hasta ver `"state":"success"`. Si el push falla por permisos de cuenta de GitHub (ya pasó una vez en este proyecto), avisar al humano en vez de intentar forzarlo.

- [ ] **Step 2: Probar con archivos reales, cubriendo los tres casos propios de esta pantalla**

En `https://transporte-df.vercel.app/viajes/importar-descarga-masivo`, con tickets de descarga reales (ver archivos ya usados en sesiones anteriores en `C:\Users\thomi\Downloads\`), armar una tanda que cubra:

- Un ticket cuyo CTG matchea un único viaje sin descarga previa → debe quedar "Listo" con "Confirmar" de un toque.
- El mismo ticket subido dos veces (o dos ticket que apunten al mismo viaje) → debe verse el aviso "Otro archivo de esta tanda también apunta a este viaje." en ambas filas, sin bloquear confirmar.
- Un CTG que matchea a varios viajes (buscar uno real con matches múltiples, como ya se hizo en sesiones anteriores) → debe quedar "Revisar", y "Ver detalle" debe mostrar el selector de viajes.
- Si hay a mano un viaje que ya tenga fecha de descarga cargada, importar un ticket para ese mismo CTG → debe quedar "Revisar" (no ofrecer confirmar de un toque), y el detalle debe pedir tildar el checkbox de sobrescritura antes de dejar guardar.

Confirmar al menos una fila real de punta a punta (de un toque y otra por detalle), verificar en `/viajes/<id>` que los datos de descarga quedaron bien cargados, y que el estado del viaje avanzó solo si correspondía (mismo mecanismo de `avanzarEstadoAutomatico` que ya está andando).

- [ ] **Step 3: Limpiar cualquier dato de prueba**

Si se usó un viaje real del cliente para probar la sobrescritura, no hace falta revertir nada (la prueba usa datos reales que igual había que cargar) -- si se creó o modificó algo puramente para la prueba (ej. se sobrescribió la descarga de un viaje real con datos de prueba), restaurar el valor original por SQL directo antes de terminar.

- [ ] **Step 4: Reportar resultado**

Si algo falló, volver a la tarea correspondiente, corregir, repetir el deploy y la verificación. Si todo salió bien, la funcionalidad queda lista para que el cliente la use.
