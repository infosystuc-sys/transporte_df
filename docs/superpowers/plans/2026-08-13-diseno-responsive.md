# App responsive para todos los dispositivos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la app sea usable en celular (navegación funcional + nada roto visualmente) y se mantenga correcta en tablet/desktop, siguiendo el spec aprobado en `docs/superpowers/specs/2026-08-13-diseno-responsive-design.md`.

**Architecture:** El sidebar fijo actual (`hidden md:block`) gana un equivalente mobile: un `Sheet` (drawer) de shadcn que se abre desde un botón hamburguesa en el header, reutilizando el mismo componente `<Sidebar>` y `navItems`. El resto de las ~19 rutas se auditan una por una en viewport de celular y se corrige lo que esté efectivamente roto — no es un rediseño, es cerrar los huecos que quedan sobre la base responsive que el proyecto ya tiene en gran parte (grillas `sm:`/`lg:`, tablas con `overflow-x-auto` de shadcn).

**Tech Stack:** Next.js 16 (App Router, Server Components), Tailwind CSS v4, shadcn/radix-ui, TanStack Table.

## Global Constraints

- Breakpoints: solo los de Tailwind ya usados en el proyecto — sin prefijo = mobile, `sm` = 640px, `md` = 768px, `lg` = 1024px. No se agregan breakpoints custom.
- No rediseñar tablas como tarjetas apiladas en mobile: el `overflow-x-auto` de `src/components/ui/table.tsx` se mantiene como está.
- No optimizar formularios largos para entrada de datos táctil (fuera de alcance del spec).
- En `md:` en adelante, el comportamiento visual actual no debe cambiar — todos los ajustes son aditivos para pantallas chicas.
- Cada task termina verificando en el navegador real (Browser tool) a 375px de ancho que no hay overflow horizontal de página: `document.documentElement.scrollWidth <= window.innerWidth` evaluado con `javascript_tool`.

---

### Task 1: Botón hamburguesa + drawer de navegación mobile

**Files:**
- Create: `src/components/ui/sheet.tsx` (generado por shadcn CLI)
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `navItems` de `src/components/layout/nav-items.ts` (ya existe, sin cambios).
- Produces: `Sidebar` sigue exportando `export function Sidebar()` sin props nuevas — el drawer se arma en el layout, no dentro de `Sidebar`, para no acoplar el componente a un estado de apertura/cierre que solo existe en mobile.

- [ ] **Step 1: Agregar el componente Sheet de shadcn**

Run: `npx shadcn add sheet -y`

Expected: crea `src/components/ui/sheet.tsx` sin tocar otros archivos (respeta `components.json`, mismo estilo que `dialog.tsx`).

- [ ] **Step 2: Verificar que el build sigue pasando con el componente nuevo**

Run: `npx next build`
Expected: build exitoso, sin errores de tipos ni de import.

- [ ] **Step 3: Agregar el botón hamburguesa y el drawer en el layout**

Editar `src/app/(app)/layout.tsx`. El `<header>` actual es:

```tsx
<header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
  <span className="text-[16.5px] font-extrabold tracking-[-0.01em]">Gestión de Fletes</span>
  <UserMenu email={user.email ?? ""} />
</header>
<div className="flex flex-1">
  <Sidebar />
  <main className="flex-1 p-6">{children}</main>
</div>
```

Reemplazar por (agrega `MenuMobile` a la izquierda del título, sin tocar nada más):

```tsx
<header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
  <div className="flex items-center gap-2">
    <MenuMobile />
    <span className="text-[16.5px] font-extrabold tracking-[-0.01em]">Gestión de Fletes</span>
  </div>
  <UserMenu email={user.email ?? ""} />
</header>
<div className="flex flex-1">
  <Sidebar />
  <main className="flex-1 p-6">{children}</main>
</div>
```

Agregar el import junto a los otros:

```tsx
import { MenuMobile } from "@/components/layout/menu-mobile";
```

- [ ] **Step 4: Crear el componente MenuMobile**

Create `src/components/layout/menu-mobile.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

export function MenuMobile() {
  const [abierto, setAbierto] = useState(false);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navegación</SheetTitle>
        <div onClick={() => setAbierto(false)}>
          <Sidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

El `onClick` en el div envolvente cierra el drawer al tocar cualquier link (delegación de evento — no hace falta pasarle callbacks a `Sidebar`).

- [ ] **Step 5: Sacar la lógica de visibilidad de `Sidebar` y moverla a cada lugar donde se usa**

`Sidebar` hoy es `<aside className="hidden w-56 shrink-0 bg-sidebar md:block">` — el `hidden md:block` vive DENTRO del componente, así que si se usa tal cual dentro del Sheet, nunca se va a mostrar en mobile (el Sheet nunca llega a los 768px del breakpoint `md`). El componente no debe decidir su propia visibilidad — eso depende de dónde se lo use (fijo en desktop, o dentro del drawer en mobile).

Editar `src/components/layout/sidebar.tsx`, cambiar la línea del `<aside>` para que ocupe el 100% del contenedor que lo envuelva, sin ocultarse a sí mismo:

```tsx
// antes:
<aside className="hidden w-56 shrink-0 bg-sidebar md:block">
// después:
<aside className="h-full w-full bg-sidebar md:w-56 md:shrink-0">
```

- [ ] **Step 6: Ocultar el Sidebar fijo de desktop en mobile desde el layout**

Ahora que `Sidebar` ya no se oculta a sí mismo, el `<Sidebar />` que está FUERA del Sheet (el fijo de desktop, dentro de `<div className="flex flex-1">` en el layout) necesita su propio wrapper con `hidden md:block` para no mostrarse duplicado junto con el del drawer.

Editar `src/app/(app)/layout.tsx`, la línea `<Sidebar />` dentro de `<div className="flex flex-1">`:

```tsx
// antes:
<Sidebar />
// después:
<div className="hidden md:block">
  <Sidebar />
</div>
```

El `<Sidebar />` que va dentro de `MenuMobile` (Step 4) no necesita ningún wrapper — el `Sheet` ya controla cuándo se muestra.

Confirmar el estado final de `sidebar.tsx`:

```tsx
// en sidebar.tsx, queda:
<aside className="h-full w-full bg-sidebar md:w-56 md:shrink-0">
```

- [ ] **Step 7: Verificar en el navegador a 375px que el drawer abre, navega y cierra**

1. `preview_start` con el proyecto (o `next dev` si ya está corriendo).
2. `resize_window` a 375x812 (preset mobile).
3. Confirmar por `read_page` que el sidebar fijo NO está visible y que el botón ☰ sí está.
4. `computer` click en el botón ☰.
5. `read_page` — confirmar que aparecen los 11 links de `navItems` (Dashboard, Viajes, Clientes, etc.) dentro de un panel deslizado.
6. `computer` click en "Viajes".
7. Confirmar por `read_page`/`get_page_text` que navegó a `/viajes` y que el drawer se cerró solo.
8. `resize_window` a 1280x800 (preset desktop), recargar, confirmar que el sidebar fijo vuelve a verse como antes (sin botón ☰ visible) — nada cambió en desktop.

- [ ] **Step 8: Typecheck y build**

Run: `npx tsc --noEmit -p tsconfig.json` y `npx next build`
Expected: ambos sin errores.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/sheet.tsx src/components/layout/menu-mobile.tsx src/components/layout/sidebar.tsx "src/app/(app)/layout.tsx"
git commit -m "Agrega navegación mobile: drawer con botón hamburguesa"
```

---

### Task 2: Dashboard (`/`) responsive

**Files:**
- Modify: `src/app/(app)/page.tsx` (solo si la auditoría encuentra algo roto — no tocar si ya está bien)
- Modify: `src/app/(app)/_componentes/graficos-dashboard.tsx` (gráficos de recharts)
- Modify: `src/app/(app)/_componentes/tarjeta-alertas.tsx` (si aplica)

**Interfaces:**
- Consumes: nada nuevo — el dashboard ya recibe sus datos vía las queries de `page.tsx` (sin cambios de esta task).

- [ ] **Step 1: Cargar el dashboard a 375px y detectar overflow**

1. Loguearse (con credenciales reales del usuario, en el navegador real — no en este flujo automatizado si no hay sesión de prueba disponible; si no hay forma de loguearse, documentar el bloqueo y saltar a Step 2 con inspección de código en su lugar).
2. `resize_window` a 375x812.
3. `javascript_tool`: `document.documentElement.scrollWidth > window.innerWidth` — si da `true`, hay overflow horizontal.
4. Si hay overflow, `javascript_tool`: recorrer `document.querySelectorAll('*')` buscando el primer elemento cuyo `getBoundingClientRect().right > window.innerWidth`, ese es el culpable a corregir primero.

- [ ] **Step 2: Revisar los patrones de layout del dashboard por código**

Leer `src/app/(app)/page.tsx` completo (ya se leyeron las primeras ~110 líneas durante el brainstorming; confirmar el resto) y `src/app/(app)/_componentes/graficos-dashboard.tsx`. Patrones a corregir si aparecen:

- Grillas con `grid-cols-N` fijo (N > 1) sin variante responsive antes de `sm:`/`lg:` → agregar `grid-cols-1` como base. Ejemplo de fix: `grid-cols-4` se convierte en `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (mismo patrón que ya usan las tarjetas de stats, confirmado durante el brainstorming en `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`).
- Gráficos de `recharts` sin `ResponsiveContainer` envolviendo el `<LineChart>`/`<BarChart>` → envolver con `<ResponsiveContainer width="100%" height={N}>`.
- Anchos fijos en `px` (`w-[Npx]`) en vez de `w-full`/`max-w-*` → cambiar a `w-full` con un `max-w-*` opcional si hace falta limitar en desktop.

- [ ] **Step 3: Aplicar los fixes encontrados**

Editar los archivos correspondientes con los patrones del Step 2. No hay diff genérico posible acá — depende de lo que la auditoría del Step 1/2 encuentre. Cada cambio debe ser una clase de Tailwind agregada o ajustada, no una reestructuración del componente.

- [ ] **Step 4: Re-verificar sin overflow**

Repetir el Step 1 completo (resize a 375px, chequeo de `scrollWidth`). Expected: `document.documentElement.scrollWidth <= window.innerWidth`.

- [ ] **Step 5: Verificar a 768px y 1280px que no se rompió nada**

`resize_window` a 768x1024 y luego a 1280x800, con `computer` screenshot en cada uno. Confirmar visualmente (por texto/estructura vía `read_page`, no hace falta juicio estético) que las 4 tarjetas de stats, los 2 gráficos y las 5 listas de alertas siguen todas visibles y sin overlap.

- [ ] **Step 6: Typecheck y build**

Run: `npx tsc --noEmit -p tsconfig.json` y `npx next build`

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/page.tsx src/app/\(app\)/_componentes/
git commit -m "Corrige overflow mobile en el dashboard"
```

(Si el Step 1-2 no encontraron nada roto, saltar el commit y documentarlo en la task siguiente — no commitear un no-op.)

---

### Task 3: Viajes (`/viajes`) y detalle de viaje (`/viajes/[id]`)

**Files:**
- Modify: `src/app/(app)/viajes/_componentes/barra-filtros.tsx` (si aplica)
- Modify: `src/app/(app)/viajes/_componentes/tabla-viajes.tsx` (si aplica)
- Modify: `src/app/(app)/viajes/[id]/page.tsx` (si aplica)
- Modify: `src/app/(app)/viajes/[id]/_componentes/tabs-viaje.tsx` (si aplica)

**Interfaces:**
- Consumes: nada nuevo.

- [ ] **Step 1: Auditar `/viajes` a 375px**

Mismo método que Task 2 / Step 1: `resize_window` a 375x812, `javascript_tool` para chequear `scrollWidth`. Prestar atención especial a:
- La fila de botones del header (`Exportar CSV`, `Importar CPE`, `Importar histórico`, `Nuevo viaje`) — hoy están en un `<div className="flex gap-2">` sin `flex-wrap`, cuatro botones de texto largo en 375px de ancho probablemente desbordan. Si desborda, cambiar a `flex flex-wrap gap-2` o, si se ve muy apretado, `grid grid-cols-2 gap-2 sm:flex` para que en mobile sea una grilla 2x2 y en `sm:` en adelante vuelva a ser una fila.
- La `BarraFiltros`: ya usa `grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5` (confirmado durante el brainstorming) — probablemente no necesita cambios, pero verificar que los `Select` no se corten.
- La tabla: confirmar que scrollea horizontalmente sin romper el ancho de la página completa (el contenedor `overflow-x-auto` de `src/components/ui/table.tsx` debe absorber el overflow, no la página).

- [ ] **Step 2: Aplicar fixes encontrados en `/viajes`**

Igual que Task 2 / Step 3 — clases de Tailwind puntuales según lo que el Step 1 haya encontrado.

- [ ] **Step 3: Re-verificar `/viajes` sin overflow a 375px**

Igual método que Task 2 / Step 4.

- [ ] **Step 4: Auditar `/viajes/[id]` a 375px**

Abrir el detalle de un viaje existente (usar cualquier id real, ej. `/viajes/19` visto durante el debugging de logs en esta misma conversación). El componente `TabsViaje` usa `@/components/ui/tabs` — confirmar que la lista de tabs no desborda: si `TabsList` no tiene `overflow-x-auto` o `flex-wrap`, en 375px con varias pestañas (Generales/Carga/Descarga/Tarifa según lo visto en `page.tsx`) puede cortarse. Si desborda, envolver `TabsList` en un contenedor con `overflow-x-auto` (mismo patrón que las tablas) en vez de forzar que las pestañas se apilen.

- [ ] **Step 5: Aplicar fixes y re-verificar `/viajes/[id]`**

Mismo ciclo que los steps anteriores.

- [ ] **Step 6: Typecheck y build**

Run: `npx tsc --noEmit -p tsconfig.json` y `npx next build`

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/viajes/"
git commit -m "Corrige overflow mobile en Viajes y detalle de viaje"
```

---

### Task 4: Listas con patrón compartido (Clientes, Camiones, Choferes, Tarifario, Gasoil, Cobros, Liquidaciones)

**Files:**
- Modify: los `_componentes/barra-filtros.tsx` (o equivalente) y `page.tsx` de cada una de las 7 rutas, según lo que la auditoría encuentre.

**Interfaces:**
- Consumes: nada nuevo.

- [ ] **Step 1: Auditar cada una de las 7 rutas a 375px**

Repetir el método de Task 3 / Step 1 (resize a 375px + chequeo de `scrollWidth` + inspección de la fila de botones de acción del header) para, en orden: `/clientes`, `/camiones`, `/choferes`, `/tarifario`, `/gasoil`, `/cobros`, `/liquidaciones`. Anotar cuáles de las 7 tienen overflow y cuáles no — al compartir el mismo patrón de `DataTable`/tabla con `overflow-x-auto`, es esperable que la mayoría no necesite cambios si el fix de la fila de botones de Task 3 ya cubrió el patrón general, pero cada una puede tener su propia cantidad de filtros/botones y hay que confirmarlo, no asumirlo (así lo pide el spec).

- [ ] **Step 2: Aplicar fixes página por página**

Para cada ruta que dio overflow en el Step 1, aplicar el mismo tipo de ajuste que en Task 3 (flex-wrap en filas de botones, grid responsive en filtros). No tocar las que ya pasaron el chequeo.

- [ ] **Step 3: Re-verificar las 7 rutas a 375px**

Repetir el chequeo de `scrollWidth` en las 7, incluidas las que no se tocaron (confirmar que siguen bien).

- [ ] **Step 4: Typecheck y build**

Run: `npx tsc --noEmit -p tsconfig.json` y `npx next build`

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/clientes src/app/\(app\)/camiones src/app/\(app\)/choferes src/app/\(app\)/tarifario src/app/\(app\)/gasoil src/app/\(app\)/cobros src/app/\(app\)/liquidaciones
git commit -m "Corrige overflow mobile en listas: clientes, camiones, choferes, tarifario, gasoil, cobros, liquidaciones"
```

---

### Task 5: Resto de las páginas (formularios de alta, detalle de chofer/liquidación, reportes, configuración, importadores)

**Files:**
- Modify: según lo que encuentre la auditoría, entre:
  - `src/app/(app)/choferes/[id]/page.tsx`
  - `src/app/(app)/cobros/nuevo/page.tsx`
  - `src/app/(app)/configuracion/page.tsx`
  - `src/app/(app)/liquidaciones/[id]/page.tsx`
  - `src/app/(app)/liquidaciones/nueva/page.tsx`
  - `src/app/(app)/reportes/page.tsx`
  - `src/app/(app)/viajes/importar-cpe/_componentes/formulario-revision-cpe.tsx`
  - `src/app/(app)/viajes/importar-historico/page.tsx` (y sus `_componentes`)
  - `src/app/(app)/viajes/nuevo/page.tsx`

**Interfaces:**
- Consumes: nada nuevo.

- [ ] **Step 1: Auditar las 9 rutas restantes a 375px**

Mismo método que Task 4 / Step 1, ruta por ruta: `/choferes/[id]`, `/cobros/nuevo`, `/configuracion`, `/liquidaciones/[id]`, `/liquidaciones/nueva`, `/reportes`, `/viajes/importar-cpe`, `/viajes/importar-historico`, `/viajes/nuevo`. Prestar atención particular a `/viajes/importar-cpe`: tiene un layout de dos columnas (formulario + preview del PDF, visto en capturas anteriores de esta conversación) que en 375px casi seguro necesita pasar a una sola columna apilada — confirmar con el chequeo de `scrollWidth` y, si el layout usa `grid-cols-2` o `lg:grid-cols-2` sin base de una columna, agregar `grid-cols-1` como base.

- [ ] **Step 2: Aplicar fixes página por página**

Mismo criterio que las tasks anteriores: solo tocar lo que efectivamente desborda o se corta, con clases de Tailwind puntuales.

- [ ] **Step 3: Re-verificar las 9 rutas a 375px**

Repetir el chequeo de `scrollWidth` en las 9.

- [ ] **Step 4: Verificación final cruzada a 768px y 1280px en toda la app**

Recorrer las 19 rutas (Tasks 2 a 5) a 768px y luego a 1280px, confirmando por `read_page`/screenshot que nada quedó roto por los cambios acumulados. Esto es una pasada de confirmación, no se espera encontrar nada nuevo si cada task se verificó en su momento.

- [ ] **Step 5: Typecheck y build**

Run: `npx tsc --noEmit -p tsconfig.json` y `npx next build`

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/choferes/\[id\] src/app/\(app\)/cobros/nuevo src/app/\(app\)/configuracion src/app/\(app\)/liquidaciones/\[id\] src/app/\(app\)/liquidaciones/nueva src/app/\(app\)/reportes "src/app/(app)/viajes/importar-cpe" "src/app/(app)/viajes/importar-historico" "src/app/(app)/viajes/nuevo"
git commit -m "Corrige overflow mobile en formularios, reportes, configuración e importadores"
```

---

## Después de completar todas las tasks

Desplegar a Vercel (mismo flujo usado en esta conversación: push a `main` en `infosystuc-sys/transporte_df` con la cuenta correcta de `gh`, esperar el deploy automático, confirmar en el navegador real a 375px sobre la URL de producción).
