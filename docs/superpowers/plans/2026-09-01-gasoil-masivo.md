# Gasoil en tanda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir subir varios comprobantes de carga de combustible de una sola vez y darlos de alta desde un checklist, matcheando cada uno contra un camión existente por patente, sin repetir el ciclo completo de subir→revisar→confirmar→volver por cada uno.

**Architecture:** Página nueva (`/gasoil-masivo`) que reutiliza toda la lógica existente de extracción y matching (`previsualizarComprobante`) y de guardado (`crearCargaGasoilConAdjunto` — no redirige hoy, así que sirve tal cual, sin ninguna acción de servidor nueva). Los archivos se procesan secuencialmente en el cliente, igual que en CPE y Descarga en tanda. A diferencia de Descarga (que actualiza un viaje ya existente por CTG), Gasoil da de alta una carga nueva por cada comprobante — más parecido a CPE en ese sentido — pero sin fase de "faltantes": si el camión no matchea, la regla ya vigente en la pantalla de un solo archivo sigue aplicando acá, nunca se crea un camión nuevo desde este flujo, hay que elegir uno existente a mano.

**Tech Stack:** Next.js 16 App Router (Server Actions), React Hook Form + Zod, Drizzle ORM/Postgres, TypeScript. Sin framework de tests en el proyecto — verificación manual (`tsc`/`eslint` en cada tarea, prueba real en producción al final), mismo patrón que los dos planes anteriores de esta serie (`docs/superpowers/plans/2026-08-28-importar-cpe-masivo.md`, `docs/superpowers/plans/2026-08-30-importar-descarga-masivo.md`).

## Global Constraints

- No se toca el comportamiento de `/gasoil` (el ABM de un solo archivo): debe funcionar exactamente igual que hoy después de cada tarea de refactor, incluyendo el `onExtraido` de `BotonCargarIA`, que hace un merge PARCIAL sobre `form.getValues()` (preserva lo que ya había si el comprobante no trajo un dato nuevo) — eso NO se toca ni se reemplaza por un reset completo.
- Nunca se crea un camión nuevo desde este flujo. Si `buscarCamionPorPatente` no encontró nada, la fila queda en "Revisar" y hay que elegir un camión ya existente del desplegable — el mismo `CampoSelect` de `camion_id` que ya existe en el formulario sirve para esto, no hace falta ningún componente de "elegir entre varios" (a diferencia de Descarga, `buscarCamionPorPatente` solo puede devolver `null` o un único id, nunca varios).
- `cargaGasoilSchema` (`src/lib/schemas/gasoil.ts`) SÍ tiene campos obligatorios: `fecha`, `camion_id`, `litros`, `modalidad`, y `importe` es obligatorio si `modalidad === "pagado_por_chofer"`. El "Confirmar" de un toque de la tanda necesita el mismo guard de `safeParse`-antes-de-confirmar que usa CPE en tanda (`confirmarRapido`): si falla, no se confirma nada y se abre el detalle de esa fila para completar a mano.
- No se agrega ningún campo de "campos dudosos" a la extracción de comprobantes (`src/lib/comprobantes/claude.ts`) — el cliente no lo pidió, queda fuera de este trabajo.
- El aviso de duplicado dentro de la tanda es "mismo camión matcheado + misma fecha leída del comprobante" (el campo `fecha` que devuelve la IA, no la fecha de hoy). Si a alguno de los dos no se le pudo leer la fecha, no se compara. Es solo un aviso (no bloquea confirmar) — a diferencia de Descarga, acá cada fila da de alta un registro nuevo e independiente, así que no hay riesgo de pisar datos de otra fila: no hace falta ninguna lógica de "downgradear" filas hermanas después de confirmar.
- Toda llamada async dentro del procesamiento por archivo va envuelta en try/catch desde el primer commit (no como corrección posterior): la revisión final de Descarga en tanda encontró que dejar `procesarUno` sin try/catch deja una fila trabada en "Procesando..." para siempre y traba el resto de la tanda si algo tira una excepción — ver `src/app/(app)/viajes/importar-descarga-masivo/_componentes/importador-masivo-descarga.tsx` como referencia de cómo se ve el patrón correcto (try/catch en `procesarUno`, try/finally alrededor del loop que llama a `setProcesando`).
- Seguir el estilo de comentarios del proyecto: sin comentarios que expliquen "qué" hace el código, solo el "por qué" cuando no es obvio.
- Todo archivo nuevo bajo `src/app/(app)/gasoil-masivo/` sigue la convención de carpetas ya usada (`page.tsx` + `_componentes/`).

---

### Task 1: Extraer los campos de revisión de gasoil a un componente compartido

**Files:**
- Create: `src/lib/gasoil/datos-catalogos.ts`
- Create: `src/app/(app)/gasoil/_componentes/campos-revision-gasoil.tsx`
- Modify: `src/app/(app)/gasoil/_componentes/gestor-gasoil.tsx`
- Modify: `src/app/(app)/gasoil/page.tsx`

**Interfaces:**
- Produces (usado por Task 4): `OpcionGasoil` (type), `CatalogosGasoil` (type), `obtenerCatalogosGasoil(): Promise<CatalogosGasoil>`.
- Produces (usado por Task 4): `opcionesModalidad` (const), `construirValoresGasoil(datos: ComprobanteExtraido): CargaGasoilInput`, `CamposRevisionGasoil` (componente).

Refactor puro salvo por la extracción del catálogo (que es la misma consulta, movida a un lugar reutilizable) — el ABM de un solo archivo debe verse y comportarse exactamente igual después de este cambio.

- [ ] **Step 1: Crear el helper de catálogos**

Crear `src/lib/gasoil/datos-catalogos.ts`:

```ts
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, estacionesServicio, viajes } from "@/db/schema";

export type OpcionGasoil = { id: number; nombre: string };

export type CatalogosGasoil = {
  camiones: OpcionGasoil[];
  choferes: OpcionGasoil[];
  estaciones: OpcionGasoil[];
  viajes: OpcionGasoil[];
};

/**
 * Mismo catálogo que ya arma /gasoil (page.tsx) para el ABM -- extraído
 * acá para que /gasoil-masivo lo reutilice sin duplicar las cuatro
 * consultas.
 */
export async function obtenerCatalogosGasoil(): Promise<CatalogosGasoil> {
  const [filasCamiones, filasChoferes, filasEstaciones, filasViajes] = await Promise.all([
    db
      .select({ id: camiones.id, nombre: camiones.dominio_tractor })
      .from(camiones)
      .orderBy(asc(camiones.dominio_tractor)),
    db
      .select({ id: choferes.id, nombre: choferes.nombre_completo })
      .from(choferes)
      .orderBy(asc(choferes.nombre_completo)),
    db
      .select({ id: estacionesServicio.id, nombre: estacionesServicio.nombre })
      .from(estacionesServicio)
      .orderBy(asc(estacionesServicio.nombre)),
    db
      .select({ id: viajes.id, numero: viajes.numero })
      .from(viajes)
      .where(eq(viajes.liquidado, false))
      .orderBy(desc(viajes.numero)),
  ]);

  return {
    camiones: filasCamiones,
    choferes: filasChoferes,
    estaciones: filasEstaciones,
    viajes: filasViajes.map((v) => ({ id: v.id, nombre: `#${v.numero}` })),
  };
}
```

- [ ] **Step 2: Usar el helper en `/gasoil/page.tsx`**

Reemplazar en `src/app/(app)/gasoil/page.tsx` el bloque `Promise.all` que arma `filasCamiones`, `filasChoferes`, `filasEstaciones`, `filasViajes` por una llamada a `obtenerCatalogosGasoil()`. El resultado final debe ser idéntico: el archivo queda así (mostrando solo las partes que cambian; el resto —imports de `cargasGasoil`/filtros/`PanelRendimiento`, la query de `filasCargas`, el JSX— se mantiene igual):

```tsx
import type { Metadata } from "next";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { cargasGasoil } from "@/db/schema";
import { obtenerCatalogosGasoil } from "@/lib/gasoil/datos-catalogos";
import { GestorGasoil } from "./_componentes/gestor-gasoil";
import { FiltrosGasoil } from "./_componentes/filtros-gasoil";
import { PanelRendimiento } from "./_componentes/panel-rendimiento";

export const metadata: Metadata = {
  title: "Gasoil — Gestión de Fletes",
};

export default async function GasoilPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const camionId = typeof sp.camion_id === "string" ? Number(sp.camion_id) : undefined;
  const estacionId = typeof sp.estacion_id === "string" ? Number(sp.estacion_id) : undefined;
  const fechaDesde = typeof sp.fecha_desde === "string" ? sp.fecha_desde : undefined;
  const fechaHasta = typeof sp.fecha_hasta === "string" ? sp.fecha_hasta : undefined;

  const condiciones: SQL[] = [];
  if (camionId) condiciones.push(eq(cargasGasoil.camion_id, camionId));
  if (estacionId) condiciones.push(eq(cargasGasoil.estacion_id, estacionId));
  if (fechaDesde) condiciones.push(gte(cargasGasoil.fecha, new Date(fechaDesde)));
  if (fechaHasta) condiciones.push(lte(cargasGasoil.fecha, new Date(fechaHasta)));
  const where = condiciones.length ? and(...condiciones) : undefined;

  const [catalogos, filasCargas] = await Promise.all([
    obtenerCatalogosGasoil(),
    (where
      ? db.select().from(cargasGasoil).where(where)
      : db.select().from(cargasGasoil)
    ).orderBy(desc(cargasGasoil.fecha)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Gasoil</h1>

      <FiltrosGasoil camiones={catalogos.camiones} estaciones={catalogos.estaciones} />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Rendimiento (según los filtros aplicados)
        </h2>
        <PanelRendimiento cargas={filasCargas} camiones={catalogos.camiones} />
      </div>

      <GestorGasoil
        filas={filasCargas}
        camiones={catalogos.camiones}
        choferes={catalogos.choferes}
        estaciones={catalogos.estaciones}
        viajes={catalogos.viajes}
      />
    </div>
  );
}
```

Antes de terminar este paso, leé `src/app/(app)/gasoil/_componentes/filtros-gasoil.tsx` y `panel-rendimiento.tsx` para confirmar que sus props (`camiones`, `estaciones`) aceptan el mismo shape `{id, nombre}` que ya usaban — no deberían necesitar cambios, pero confirmalo antes de asumirlo.

- [ ] **Step 3: Crear el componente compartido de campos**

Crear `src/app/(app)/gasoil/_componentes/campos-revision-gasoil.tsx`:

```tsx
"use client";

import { CampoBooleano, CampoSelect, CampoTexto } from "@/components/catalogos/campos-formulario";
import { formatoFechaInput } from "@/lib/schemas/campos-fecha";
import type { UseFormReturn } from "react-hook-form";
import type { CargaGasoilInput } from "@/lib/schemas/gasoil";
import type { ComprobanteExtraido } from "@/lib/comprobantes/claude";
import type { OpcionGasoil } from "@/lib/gasoil/datos-catalogos";

export const opcionesModalidad = [
  { value: "cuenta_corriente", label: "Cuenta corriente (empresa)" },
  { value: "pagado_por_chofer", label: "Pagado por el chofer" },
  { value: "surtidor_propio", label: "Surtidor propio" },
];

/**
 * Solo la usa la pantalla en tanda (Task 4): arranca un formulario nuevo
 * desde cero a partir de lo que leyó la IA. La pantalla de un solo
 * archivo NO usa esto -- su onExtraido hace un merge parcial sobre los
 * valores que ya había en el formulario, comportamiento que no cambia.
 */
export function construirValoresGasoil(datos: ComprobanteExtraido): CargaGasoilInput {
  return {
    fecha: (datos.fecha ? formatoFechaInput(datos.fecha) : undefined) as unknown as Date,
    camion_id: (datos.camion_id ?? undefined) as unknown as number,
    chofer_id: datos.chofer_id ?? undefined,
    viaje_id: undefined,
    estacion_id: undefined,
    litros: datos.litros != null ? String(datos.litros) : "",
    precio_litro: "",
    importe: datos.importe_total != null ? String(datos.importe_total) : "",
    odometro: undefined,
    modalidad: "cuenta_corriente",
    rendido: false,
    comprobante_nro: datos.comprobante_nro ?? "",
    observaciones: "",
  };
}

export function CamposRevisionGasoil({
  form,
  camiones,
  choferes,
  estaciones,
  viajes,
}: {
  form: UseFormReturn<CargaGasoilInput>;
  camiones: OpcionGasoil[];
  choferes: OpcionGasoil[];
  estaciones: OpcionGasoil[];
  viajes: OpcionGasoil[];
}) {
  const opciones = (lista: OpcionGasoil[]) => lista.map((o) => ({ value: String(o.id), label: o.nombre }));

  return (
    <>
      <CampoTexto form={form} name="fecha" label="Fecha" tipo="date" />
      <CampoSelect form={form} name="camion_id" label="Camión" opciones={opciones(camiones)} />
      <CampoSelect form={form} name="chofer_id" label="Chofer" opciones={opciones(choferes)} />
      <CampoSelect form={form} name="estacion_id" label="Estación" opciones={opciones(estaciones)} />
      <CampoSelect form={form} name="viaje_id" label="Viaje (opcional)" opciones={opciones(viajes)} />
      <CampoTexto form={form} name="litros" label="Litros" />
      <CampoTexto form={form} name="precio_litro" label="Precio por litro ($)" />
      <CampoTexto form={form} name="importe" label="Importe total ($)" />
      <CampoTexto form={form} name="odometro" label="Odómetro (km)" tipo="number" />
      <CampoSelect form={form} name="modalidad" label="Modalidad de pago" opciones={opcionesModalidad} />
      <CampoBooleano form={form} name="rendido" label="Rendido (si lo pagó el chofer)" />
      <CampoTexto form={form} name="comprobante_nro" label="N° de comprobante" />
      <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />
    </>
  );
}
```

- [ ] **Step 4: Usar `CamposRevisionGasoil` y `opcionesModalidad` en `gestor-gasoil.tsx`**

En `src/app/(app)/gasoil/_componentes/gestor-gasoil.tsx`:
- Eliminar la constante local `opcionesModalidad` (líneas 40-44) e importarla en cambio desde `./campos-revision-gasoil`.
- El `type Opcion = { id: number; nombre: string }` local (línea 18) NO se toca: sigue usándose tal cual para tipar las props `camiones`/`choferes`/`estaciones`/`viajes` de `GestorGasoil`. No hace falta unificarlo con `OpcionGasoil` (mismo shape estructural, TypeScript los trata como compatibles sin ningún cambio).
- Dentro de `campos={(form) => (...)}`, reemplazar TODO el bloque de campos que va desde `<CampoTexto form={form} name="fecha" .../>` hasta `<CampoTexto form={form} name="observaciones" .../>` (todo lo que hoy está después del `BotonCargarIA` y su párrafo de ayuda) por:

```tsx
<CamposRevisionGasoil
  form={form}
  camiones={camiones}
  choferes={choferes}
  estaciones={estaciones}
  viajes={viajes}
/>
```

  (Import: `import { CamposRevisionGasoil, opcionesModalidad } from "./campos-revision-gasoil";`)

- El `BotonCargarIA` y su `onExtraido` callback (líneas 150-179 aproximadamente) NO se tocan -- siguen haciendo el merge parcial con `form.getValues()` exactamente como hoy.
- Los imports de `CampoBooleano, CampoSelect, CampoTexto` de `@/components/catalogos/campos-formulario` que ya no se usen directamente en este archivo (si `CamposRevisionGasoil` fue el único consumidor) se eliminan.

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores.

- [ ] **Step 6: Verificar en el navegador que `/gasoil` sigue igual**

Arrancar el server local, entrar a `/gasoil`, abrir "Agregar carga de gasoil", confirmar que todos los campos aparecen igual que antes (Fecha, Camión, Chofer, Estación, Viaje, Litros, Precio por litro, Importe total, Odómetro, Modalidad de pago, Rendido, N° de comprobante, Observaciones), sin errores de consola. Los filtros y el panel de rendimiento en la parte de arriba de la página también deben verse igual.

- [ ] **Step 7: Commit**

```bash
git add src/lib/gasoil/datos-catalogos.ts "src/app/(app)/gasoil/_componentes/campos-revision-gasoil.tsx" "src/app/(app)/gasoil/_componentes/gestor-gasoil.tsx" "src/app/(app)/gasoil/page.tsx"
git commit -m "Extrae los campos de revision de gasoil y el catalogo compartido a un componente reutilizable"
```

---

### Task 2: Página nueva `/gasoil-masivo` (esqueleto)

**Files:**
- Create: `src/app/(app)/gasoil-masivo/page.tsx`
- Create: `src/app/(app)/gasoil-masivo/_componentes/importador-masivo-gasoil.tsx` (esqueleto vacío, se completa en Tasks 3-4)

**Interfaces:**
- Consumes: `obtenerCatalogosGasoil(): Promise<CatalogosGasoil>` (Task 1).

- [ ] **Step 1: Crear la página**

```tsx
// src/app/(app)/gasoil-masivo/page.tsx
import type { Metadata } from "next";
import { obtenerCatalogosGasoil } from "@/lib/gasoil/datos-catalogos";
import { ImportadorMasivoGasoil } from "./_componentes/importador-masivo-gasoil";

export const metadata: Metadata = {
  title: "Gasoil en tanda — Gestión de Fletes",
};

export default async function GasoilMasivoPage() {
  const catalogos = await obtenerCatalogosGasoil();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Gasoil en tanda</h1>
        <p className="text-sm text-muted-foreground">
          Subí varios comprobantes de carga de combustible de una: la app va buscando el camión de
          cada uno por patente y te deja confirmar sin salir de esta pantalla.
        </p>
      </div>
      <ImportadorMasivoGasoil
        camiones={catalogos.camiones}
        choferes={catalogos.choferes}
        estaciones={catalogos.estaciones}
        viajes={catalogos.viajes}
      />
    </div>
  );
}
```

- [ ] **Step 2: Crear el esqueleto del componente cliente**

```tsx
// src/app/(app)/gasoil-masivo/_componentes/importador-masivo-gasoil.tsx
"use client";

import type { OpcionGasoil } from "@/lib/gasoil/datos-catalogos";

export function ImportadorMasivoGasoil({
  camiones,
  choferes,
  estaciones,
  viajes,
}: {
  camiones: OpcionGasoil[];
  choferes: OpcionGasoil[];
  estaciones: OpcionGasoil[];
  viajes: OpcionGasoil[];
}) {
  void camiones;
  void choferes;
  void estaciones;
  void viajes;
  return <p className="text-sm text-muted-foreground">Próximamente.</p>;
}
```

- [ ] **Step 3: Verificar tipos y en el navegador**

```bash
npx tsc --noEmit -p .
```

Confirmar en local que `/gasoil-masivo` carga el título y "Próximamente." sin errores de consola.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/gasoil-masivo/
git commit -m "Agrega la ruta de Gasoil en tanda (esqueleto)"
```

---

### Task 3: Selección de varios archivos y procesamiento secuencial

**Files:**
- Modify: `src/app/(app)/gasoil-masivo/_componentes/importador-masivo-gasoil.tsx`

**Interfaces:**
- Consumes: `previsualizarComprobante(formData: FormData): Promise<ComprobanteExtraido | {error: string}>` (de `@/lib/comprobantes/actions`, ya existe -- nota que NO es `{ok:true,...}|{ok:false,error}` como en Descarga, sino `ComprobanteExtraido | {error}` directo, hay que chequear `"error" in resultado`, igual que hace `BotonCargarIA` hoy).
- Produces (usado por Task 4): `EstadoItemGasoil` (type), `ItemLoteGasoil` (type).

- [ ] **Step 1: Implementar el estado por archivo y el procesamiento secuencial, con try/catch desde el inicio**

```tsx
// src/app/(app)/gasoil-masivo/_componentes/importador-masivo-gasoil.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previsualizarComprobante } from "@/lib/comprobantes/actions";
import type { ComprobanteExtraido } from "@/lib/comprobantes/claude";
import type { OpcionGasoil } from "@/lib/gasoil/datos-catalogos";

export type EstadoItemGasoil = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLoteGasoil = {
  id: string;
  archivo: File;
  estado: EstadoItemGasoil;
  datosExtraidos: ComprobanteExtraido | null;
  error: string | null;
};

const ETIQUETAS_ESTADO_ITEM: Record<EstadoItemGasoil, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando...",
  listo: "Listo",
  revisar: "Revisar",
  error: "Error",
  confirmado: "Confirmado",
};

const MENSAJE_ERROR_GENERICO = "No se pudo procesar el comprobante.";

export function ImportadorMasivoGasoil({
  camiones,
  choferes,
  estaciones,
  viajes,
}: {
  camiones: OpcionGasoil[];
  choferes: OpcionGasoil[];
  estaciones: OpcionGasoil[];
  viajes: OpcionGasoil[];
}) {
  void choferes;
  void estaciones;
  void viajes;
  const [items, setItems] = useState<ItemLoteGasoil[]>([]);
  const [procesando, setProcesando] = useState(false);

  function actualizarItem(id: string, cambios: Partial<ItemLoteGasoil>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  async function procesarUno(item: ItemLoteGasoil) {
    actualizarItem(item.id, { estado: "procesando", error: null });
    try {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      const resultado = await previsualizarComprobante(formData);
      if ("error" in resultado) {
        actualizarItem(item.id, { estado: "error", error: resultado.error });
        return;
      }
      // Regla vigente en la pantalla de un solo archivo: nunca se crea un
      // camión nuevo desde acá -- si no matcheó, hay que elegirlo a mano.
      const necesitaRevision = resultado.camion_id == null;
      actualizarItem(item.id, {
        estado: necesitaRevision ? "revisar" : "listo",
        datosExtraidos: resultado,
      });
    } catch (err) {
      console.error("procesarUno (gasoil):", err);
      const mensaje = err instanceof Error ? err.message : MENSAJE_ERROR_GENERICO;
      actualizarItem(item.id, { estado: "error", error: mensaje });
    }
  }

  async function onSeleccionarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    const nuevosItems: ItemLoteGasoil[] = archivos.map((archivo) => ({
      id: crypto.randomUUID(),
      archivo,
      estado: "pendiente",
      datosExtraidos: null,
      error: null,
    }));
    setItems(nuevosItems);
    e.target.value = "";

    setProcesando(true);
    try {
      for (const item of nuevosItems) {
        await procesarUno(item);
      }
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivos-gasoil">Comprobantes de carga de combustible</Label>
          <Input
            id="archivos-gasoil"
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

Notar que `camiones` (y por ahora `choferes`/`estaciones`/`viajes`, todavía sin usar hasta Task 4) llegan como prop desde la página pero no participan en el matching -- eso ya lo hizo `previsualizarComprobante` en el servidor (mismo patrón que hoy en `BotonCargarIA`). Las listas de catálogo son para poblar los `<select>` del detalle en Task 4.

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores (puede haber warnings de eslint por los `void` temporales de props sin usar todavía -- se resuelven en Task 4 cuando se usan de verdad).

- [ ] **Step 3: Verificar en el navegador (local, sin IA real)**

En `/gasoil-masivo`, seleccionar 2-3 archivos cualquiera. Sin `ANTHROPIC_API_KEY` local, `previsualizarComprobante` va a devolver `{error: "No se pudo leer el comprobante automáticamente. Cargá los datos a mano."}` para cada uno -- confirmar que cada fila termina en "Error" con ese mensaje, EN ORDEN (no todas a la vez), y que no hay errores de consola.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/gasoil-masivo/_componentes/importador-masivo-gasoil.tsx"
git commit -m "Procesa varios comprobantes de gasoil secuencialmente con estado por archivo"
```

---

### Task 4: Checklist con confirmar/ver detalle, matching de camión y aviso de duplicado

**Files:**
- Modify: `src/app/(app)/gasoil-masivo/_componentes/importador-masivo-gasoil.tsx`

**Interfaces:**
- Consumes: `CamposRevisionGasoil`, `construirValoresGasoil`, `opcionesModalidad` (Task 1); `crearCargaGasoilConAdjunto` (de `../actions`, ya existe, sin cambios de firma); `cargaGasoilSchema` (de `@/lib/schemas/gasoil`, para el guard de `safeParse`).

- [ ] **Step 1: Agregar el checklist, el detalle expandible, el guard de `safeParse` y el aviso de duplicado**

Reemplazar el contenido entero de `importador-masivo-gasoil.tsx` por:

```tsx
// src/app/(app)/gasoil-masivo/_componentes/importador-masivo-gasoil.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cargaGasoilSchema, type CargaGasoilInput } from "@/lib/schemas/gasoil";
import { previsualizarComprobante } from "@/lib/comprobantes/actions";
import type { ComprobanteExtraido } from "@/lib/comprobantes/claude";
import type { OpcionGasoil } from "@/lib/gasoil/datos-catalogos";
import { crearCargaGasoilConAdjunto } from "../../gasoil/actions";
import { CamposRevisionGasoil, construirValoresGasoil } from "../../gasoil/_componentes/campos-revision-gasoil";

export type EstadoItemGasoil = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLoteGasoil = {
  id: string;
  archivo: File;
  estado: EstadoItemGasoil;
  datosExtraidos: ComprobanteExtraido | null;
  error: string | null;
};

const ETIQUETAS_ESTADO_ITEM: Record<EstadoItemGasoil, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando...",
  listo: "Listo",
  revisar: "Revisar",
  error: "Error",
  confirmado: "Confirmado",
};

const MENSAJE_ERROR_GENERICO = "No se pudo procesar el comprobante.";

export function ImportadorMasivoGasoil({
  camiones,
  choferes,
  estaciones,
  viajes,
}: {
  camiones: OpcionGasoil[];
  choferes: OpcionGasoil[];
  estaciones: OpcionGasoil[];
  viajes: OpcionGasoil[];
}) {
  const [items, setItems] = useState<ItemLoteGasoil[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [idAbierto, setIdAbierto] = useState<string | null>(null);
  const [isPendingConfirmar, startTransitionConfirmar] = useTransition();

  const form = useForm<CargaGasoilInput>({ resolver: zodResolver(cargaGasoilSchema) });

  // Aviso, no bloqueo -- pedido explícito del cliente. A diferencia de
  // Descarga, acá cada fila da de alta un registro nuevo e independiente
  // (no hay "el mismo viaje" que se pueda pisar), así que no hace falta
  // ninguna lógica de downgrade al confirmar una de las dos.
  const duplicadosEnLote = useMemo(() => {
    const claves = new Map<string, number>();
    for (const it of items) {
      const camionId = it.datosExtraidos?.camion_id;
      const fecha = it.datosExtraidos?.fecha;
      if (camionId == null || !fecha) continue;
      const clave = `${camionId}:${fecha}`;
      claves.set(clave, (claves.get(clave) ?? 0) + 1);
    }
    const repetidas = new Set([...claves.entries()].filter(([, n]) => n > 1).map(([k]) => k));
    return (it: ItemLoteGasoil) => {
      const camionId = it.datosExtraidos?.camion_id;
      const fecha = it.datosExtraidos?.fecha;
      if (camionId == null || !fecha) return false;
      return repetidas.has(`${camionId}:${fecha}`);
    };
  }, [items]);

  function actualizarItem(id: string, cambios: Partial<ItemLoteGasoil>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  async function procesarUno(item: ItemLoteGasoil) {
    actualizarItem(item.id, { estado: "procesando", error: null });
    try {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      const resultado = await previsualizarComprobante(formData);
      if ("error" in resultado) {
        actualizarItem(item.id, { estado: "error", error: resultado.error });
        return;
      }
      const necesitaRevision = resultado.camion_id == null;
      actualizarItem(item.id, {
        estado: necesitaRevision ? "revisar" : "listo",
        datosExtraidos: resultado,
      });
    } catch (err) {
      console.error("procesarUno (gasoil):", err);
      const mensaje = err instanceof Error ? err.message : MENSAJE_ERROR_GENERICO;
      actualizarItem(item.id, { estado: "error", error: mensaje });
    }
  }

  async function onSeleccionarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    const nuevosItems: ItemLoteGasoil[] = archivos.map((archivo) => ({
      id: crypto.randomUUID(),
      archivo,
      estado: "pendiente",
      datosExtraidos: null,
      error: null,
    }));
    setItems(nuevosItems);
    setIdAbierto(null);
    e.target.value = "";

    setProcesando(true);
    try {
      for (const item of nuevosItems) {
        await procesarUno(item);
      }
    } finally {
      setProcesando(false);
    }
  }

  function abrirDetalle(item: ItemLoteGasoil) {
    setIdAbierto(item.id);
    if (item.datosExtraidos) {
      form.reset(construirValoresGasoil(item.datosExtraidos));
    }
  }

  function cerrarDetalle() {
    setIdAbierto(null);
  }

  async function confirmarValores(itemId: string, valores: CargaGasoilInput) {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    startTransitionConfirmar(async () => {
      try {
        const formData = new FormData();
        formData.set("archivo", item.archivo);
        formData.set("datos", JSON.stringify(valores));
        const r = await crearCargaGasoilConAdjunto(formData);
        if (r?.error) {
          toast.error(r.error);
          return;
        }
        actualizarItem(itemId, { estado: "confirmado" });
        toast.success("Carga de gasoil registrada.");
        if (idAbierto === itemId) setIdAbierto(null);
      } catch (err) {
        console.error("crearCargaGasoilConAdjunto falló:", err);
        const mensaje = err instanceof Error ? err.message : String(err);
        toast.error(`No se pudo registrar la carga: ${mensaje}`);
      }
    });
  }

  function confirmarRapido(item: ItemLoteGasoil) {
    if (!item.datosExtraidos) return;
    const valores = construirValoresGasoil(item.datosExtraidos);
    const parseado = cargaGasoilSchema.safeParse(valores);
    if (!parseado.success) {
      abrirDetalle(item);
      toast.error("Revisá los datos antes de confirmar esta fila.");
      return;
    }
    confirmarValores(item.id, valores);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivos-gasoil">Comprobantes de carga de combustible</Label>
          <Input
            id="archivos-gasoil"
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
              const repetido = it.estado !== "confirmado" && duplicadosEnLote(it);
              const camionNombre =
                it.datosExtraidos?.camion_id != null
                  ? (camiones.find((c) => c.id === it.datosExtraidos!.camion_id)?.nombre ?? "—")
                  : null;
              return (
                <li key={it.id} className="flex flex-col gap-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{it.archivo.name}</span>
                      {camionNombre && (
                        <span className="text-xs text-muted-foreground">
                          Camión {camionNombre}
                          {it.datosExtraidos?.litros != null ? ` · ${it.datosExtraidos.litros} L` : ""}
                        </span>
                      )}
                      {repetido && (
                        <span className="text-xs text-destructive">
                          Otro archivo de esta tanda también apunta a este camión en la misma fecha.
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
                      {it.estado === "confirmado" && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/gasoil">Ver en Gasoil</Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {idAbierto === it.id && it.datosExtraidos && (
                    <div className="flex flex-col gap-4 border-t pt-4">
                      <form
                        onSubmit={form.handleSubmit((valores) => confirmarValores(it.id, valores))}
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                      >
                        <CamposRevisionGasoil
                          form={form}
                          camiones={camiones}
                          choferes={choferes}
                          estaciones={estaciones}
                          viajes={viajes}
                        />
                        <div className="flex gap-3 sm:col-span-2">
                          <Button type="submit" disabled={isPendingConfirmar}>
                            {isPendingConfirmar ? "Guardando..." : "Confirmar y registrar carga"}
                          </Button>
                          <Button type="button" variant="outline" onClick={cerrarDetalle}>
                            Cerrar
                          </Button>
                        </div>
                      </form>
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

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit -p .
```

Expected: sin errores.

- [ ] **Step 3: Verificar en el navegador (local)**

En `/gasoil-masivo`, subir 2-3 archivos cualquiera. Sin `ANTHROPIC_API_KEY` local van a terminar todos en "Error" -- confirmar que "Reintentar" funciona y que no hay errores de consola. El chequeo completo (camión matcheado vs. no matcheado, duplicado, confirmar de verdad) queda para el Task 6 contra producción.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/gasoil-masivo/_componentes/importador-masivo-gasoil.tsx"
git commit -m "Agrega el checklist de Gasoil en tanda: confirmar, ver detalle y aviso de duplicado"
```

---

### Task 5: Enlazar la pantalla nueva desde la navegación

**Files:**
- Modify: `src/app/(app)/gasoil/page.tsx`

**Interfaces:** ninguna (solo JSX/links).

- [ ] **Step 1: Agregar un botón/enlace cruzado en la pantalla de Gasoil**

En `src/app/(app)/gasoil/page.tsx`, agregar un import de `Link` de `next/link` y de `Button` de `@/components/ui/button`, y modificar el encabezado para incluir el enlace:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
```

```tsx
<div className="flex flex-wrap items-center justify-between gap-2">
  <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Gasoil</h1>
  <Button variant="outline" asChild>
    <Link href="/gasoil-masivo">Cargar varios comprobantes</Link>
  </Button>
</div>
```

(Reemplaza el `<h1>` suelto que hoy está solo en su propia línea.)

- [ ] **Step 2: Agregar el cross-link inverso en `/gasoil-masivo`**

En `src/app/(app)/gasoil-masivo/page.tsx`, agregar debajo del párrafo descriptivo:

```tsx
import Link from "next/link";
```

```tsx
<p className="text-sm text-muted-foreground">
  ¿Es un solo comprobante?{" "}
  <Link href="/gasoil" className="text-primary underline">
    Cargalo desde Gasoil
  </Link>
  .
</p>
```

- [ ] **Step 3: Verificar tipos y en el navegador**

```bash
npx tsc --noEmit -p .
```

Confirmar en local que ambos links aparecen y navegan correctamente.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/gasoil/page.tsx" "src/app/(app)/gasoil-masivo/page.tsx"
git commit -m "Enlaza Gasoil en tanda desde Gasoil y viceversa"
```

---

### Task 6: Verificación de punta a punta en producción

**Files:** ninguno (solo verificación; puede generar commits de fix si algo falla).

- [ ] **Step 1: Deploy**

```bash
git push origin main
```

Confirmar el estado del deploy vía `gh api repos/infosystuc-sys/transporte_df/commits/<sha>/status` hasta ver `"state":"success"`. Si el push falla por permisos de cuenta de GitHub, avisar al humano en vez de intentar forzarlo (ya pasó antes en este proyecto: `gh auth switch --user infosystuc-sys` lo resuelve, y el humano ya autorizó hacerlo directamente).

- [ ] **Step 2: Probar con comprobantes reales, cubriendo los tres casos propios de esta pantalla**

En `https://transporte-df.vercel.app/gasoil-masivo`, con comprobantes de gasoil reales (facturas y tickets de surtidor, algunos con patentes que ya existan en Camiones y alguno con una patente que no exista), armar una tanda que cubra:

- Un comprobante cuya patente matchea un camión existente → debe quedar "Listo" con "Confirmar" de un toque.
- Un comprobante cuya patente NO matchea ningún camión (o no trae patente legible) → debe quedar "Revisar", y el detalle debe mostrar el desplegable de Camión vacío para elegir uno existente a mano -- confirmar que NO hay ninguna opción de "crear camión nuevo" en ningún lado de este flujo.
- El mismo comprobante subido dos veces (o dos comprobantes del mismo camión con la misma fecha) → debe verse el aviso "Otro archivo de esta tanda también apunta a este camión en la misma fecha." en ambas filas, sin bloquear confirmar.

Confirmar al menos una fila real de punta a punta (de un toque y otra por detalle eligiendo el camión a mano), y verificar en `/gasoil` que la carga quedó bien registrada con los datos correctos y el adjunto guardado.

- [ ] **Step 3: Limpiar cualquier dato de prueba**

Si se creó alguna carga de gasoil puramente para la prueba (no un comprobante real que el cliente ya necesitaba cargar), borrarla desde el ABM de `/gasoil` al terminar. Si el adjunto quedó en Supabase Storage y no hay `SUPABASE_SERVICE_ROLE_KEY` disponible localmente para borrarlo, reportarlo como gap conocido igual que en las tandas anteriores (no bloquea, es de bajo riesgo).

- [ ] **Step 4: Reportar resultado**

Si algo falló, volver a la tarea correspondiente, corregir, repetir el deploy y la verificación. Si todo salió bien, la funcionalidad queda lista para que el cliente la use — con esto se completan los tres flujos de la serie "en tanda" (CPE, Descarga, Gasoil).
