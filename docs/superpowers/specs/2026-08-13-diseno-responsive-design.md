# Diseño responsive para todos los dispositivos

## Contexto

La app (`src/app/(app)/`) no tiene forma de navegar en pantallas chicas: el
`<Sidebar>` usa `hidden w-56 shrink-0 bg-sidebar md:block`, así que por
debajo de 768px desaparece sin ningún reemplazo. El resto del código ya
tiene bastante cobertura responsive parcial (grillas con `sm:`/`lg:` en
formularios y en las tarjetas del dashboard, tablas con `overflow-x-auto`
de shadcn), pero no está verificado de forma sistemática.

## Propósito

Que la app se pueda usar para **consulta rápida desde el celular** (mirar
el dashboard, la lista de viajes, el detalle de un viaje) sin que nada se
rompa visualmente, y que el resto de las pantallas (formularios, listas,
reportes) sean al menos usables — sin necesidad de optimizar cada
formulario para carga de datos cómoda con el pulgar.

## Alcance

Las ~20 rutas bajo `src/app/(app)/` (todo lo que cuelga del layout con
sidebar). No incluye `/login` (ya es una pantalla simple de un solo
formulario centrado).

Fuera de alcance: rediseñar las tablas como tarjetas apiladas en mobile
(el scroll horizontal de shadcn se mantiene), optimizar formularios largos
para entrada de datos táctil, o cambiar la paleta/tipografía.

## Diseño

### 1. Navegación: drawer con botón hamburguesa

- El header (`src/app/(app)/layout.tsx`) gana un botón ☰ visible solo por
  debajo de `md`, a la izquierda del título.
- Al tocarlo, abre el `<Sidebar>` existente dentro de un `Sheet` (shadcn,
  ya disponible vía `radix-ui`) deslizado desde la izquierda, con overlay.
  Mismo `navItems`, mismo componente de lista de links — el `Sidebar` no
  se reescribe, solo se le agrega el contenedor mobile.
- En `md:` en adelante, el comportamiento actual (sidebar fijo a la
  izquierda) no cambia en absoluto.
- Al navegar a un link, el drawer se cierra solo.

### 2. Breakpoints

Los de Tailwind que el proyecto ya usa en todos lados: sin prefijo =
mobile (~375px de referencia), `sm` = 640px, `md` = 768px (tablet), `lg` =
1024px (desktop). No se agregan breakpoints custom.

### 3. Enfoque para el resto de las páginas: auditar y arreglar

Para cada ruta bajo `src/app/(app)/`, verificar en viewport de 375px
(celular) con el navegador real y corregir lo que esté efectivamente roto:

- Overflow horizontal de la página completa (la causa más común: un
  `flex` sin `flex-wrap`, un `grid-cols-N` fijo sin variante responsive,
  o un ancho fijo en px).
- Botones/acciones que se salen de la pantalla o quedan inalcanzables.
- Texto cortado o superpuesto.
- Gráficos del dashboard (recharts) que no se adaptan al ancho del
  contenedor.

Lo que NO se toca si ya funciona (aunque no sea "óptimo"): tablas con
scroll horizontal, formularios de una sola columna en mobile que ya
funcionan aunque requieran scroll vertical largo.

### 4. Orden de trabajo

1. Header + Sidebar → drawer (cambio único, beneficia a todas las
   páginas).
2. Dashboard (`/`), Viajes (`/viajes`), detalle de viaje (`/viajes/[id]`)
   — las tres que se dijo que más se consultan desde el celular.
3. Resto de las listas con el mismo patrón (Clientes, Camiones, Choferes,
   Tarifario, Gasoil, Cobros, Liquidaciones) — al compartir `BarraFiltros`
   + `DataTable` + `Paginacion`, si el patrón funciona en Viajes debería
   funcionar igual en el resto; se verifica cada una igual, no se asume.
4. El resto (Reportes, Configuración, importar CPE/histórico, formularios
   de alta) con el mismo criterio de auditoría.

## Testing

Verificación manual en el navegador (Browser tool) a tres anchos por
página: 375px (celular), 768px (tablet), 1280px (desktop) — confirmando
que no aparece scroll horizontal de página y que la navegación por drawer
funciona en mobile. No se agregan tests automatizados de layout (no hay
precedente de tests visuales en este proyecto).
