# Sistema de gestión para empresa de fletes (Tucumán, AR)

Fecha: 2026-08-06
Estado: aprobado para iniciar Fase 1

## 1. Contexto y objetivo

Empresa de transporte de cargas de Tucumán, un solo CUIT, flota propia (~30 camiones).
Transporta principalmente granos a granel (maíz, soja, trigo, arroz) de terceros (90% de
la carga) y en menor medida fertilizantes a granel y carga propia. Hoy todo se lleva en
planillas Excel anuales por tipo de carga.

Objetivo: reemplazar el Excel por una app que controle el ciclo completo de cada viaje
(carga → descarga → merma → tarifa → gastos → cobro al cliente → liquidación al chofer),
partiendo de tres reglas ya validadas contra el Excel real:

- La tarifa es un valor en $/tonelada.
- `TOTAL = TARIFA × TN DESTINO` (no origen — así se factura hoy).
- El chofer cobra 15% de ese total (configurable por chofer).

Documentos de respaldo del negocio: Carta de Porte Electrónica (CPE) Automotor emitida
por la propia empresa en ARCA (ex AFIP), y remitos de proveedor para cargas sin CPE
(ej. fertilizante). Se confirmó contra archivos reales (ver `fixtures/`) que:

- La CPE emitida por ARCA tiene texto seleccionable (no es escaneada) → el parser de
  texto por etiquetas es el camino principal y confiable.
- Los remitos de proveedor (ej. Yara) suelen ser fotos/escaneos sin capa de texto → van
  como adjunto del viaje, no se intenta extraerlos automáticamente.
- La planilla Excel real tiene filas de subtotal sin fecha ni CTG (solo un importe en la
  columna del chofer) que el importador debe ignorar.

## 2. Alcance

Ver el documento fuente de requerimientos (aportado por el usuario el 2026-08-06) para el
detalle campo por campo del modelo de datos, las reglas de negocio, las pantallas y los
reportes — esa versión es la referencia normativa. Este documento fija las decisiones
técnicas y de proceso para poder empezar a construir.

**Fuera de alcance** (explícito, no se construye): roles/permisos, app móvil o carga por
choferes, modo offline, emisión de facturas o integración con ARCA para facturar (se hace
en Sinagro externo), cuenta corriente de clientes con antigüedad de saldos, multiempresa/
multi-CUIT, multimoneda, funcionalidad de contrafletes (solo el campo FK preparado).

## 3. Arquitectura y stack

- **Next.js (App Router) + TypeScript strict**, React Server Components y Server Actions
  como mecanismo principal de mutación (mínimo fetching client-side).
- **Supabase**: Postgres, Auth (email + password), Storage para adjuntos (bucket privado,
  URLs firmadas).
- **Drizzle ORM**, driver `postgres.js`, migraciones versionadas en `/drizzle` generadas
  con `drizzle-kit`. Nada de editar el esquema a mano desde el dashboard de Supabase.
- **UI**: Tailwind + shadcn/ui, tema neutro por defecto (herramienta interna, no requiere
  inversión de diseño de marca salvo que se pida). TanStack Table para listados con
  filtro/orden/paginación server-side. react-hook-form + Zod, schemas compartidos entre
  cliente y servidor.
- **Excel**: librería `xlsx` (SheetJS), tanto para el importador de histórico (fase 13)
  como para exportar reportes.
- **PDF/QR de la CPE**: `unpdf` para extraer texto (camino principal, sin dependencias
  externas); `pdfjs-dist` + `jsqr` para renderizar la primera página y leer el QR como
  respaldo; fallback opcional a la API de Anthropic (Claude, entrada de imagen) para PDFs
  escaneados sin capa de texto, detrás de `ANTHROPIC_API_KEY` — se construye completo
  desde el inicio (confirmado por el usuario).
- **Gráficos**: `recharts` para el dashboard.
- **Dinero**: `numeric(14,2)` en Postgres, modo string en Drizzle, jamás `float`; formato
  es-AR vía `Intl.NumberFormat` en el front. Pesos en `numeric(12,2)`, porcentajes en
  `numeric(6,3)`. Fechas `timestamptz`, zona `America/Argentina/Cordoba`.
- **Idioma**: toda la UI, nombres de tablas/columnas y mensajes de error en español
  (snake_case en base de datos). Código comentado en español.
- **Tests**: no se arma suite automática formal salvo que se pida más adelante; cada fase
  se valida con `tsc --noEmit` + build antes de mostrarse para revisión.
- **Deploy**: Vercel + Supabase. `.env.example` con todas las variables necesarias y
  `README.md` con pasos de instalación. El deploy real a Vercel no se ejecuta hasta que
  el usuario lo pida explícitamente.

## 4. Decisiones confirmadas con el usuario (2026-08-06)

1. **Supabase**: el usuario ya tiene un proyecto creado. Va a completar `.env.local` con
   las credenciales directamente (no se piden secretos por chat). El MCP de Supabase no
   está autorizado en esta sesión, así que las migraciones se aplican con `drizzle-kit`
   contra la connection string que el usuario provea.
2. **Git**: repo inicializado en `d:\APP\FLETE` (`git init` ya ejecutado).
3. **Fallback de Claude para CPE escaneadas**: se construye completo desde la Fase 10
   (importación de CPE), detrás de `ANTHROPIC_API_KEY`. Si la variable no está seteada en
   el entorno, el sistema informa que hay que cargar los datos a mano (comportamiento ya
   especificado en el requerimiento original).
4. **Archivos de referencia reales** aportados por el usuario: se movieron a `/fixtures`
   como material de prueba real:
   - `fixtures/cpe/10133965615.pdf` — CPE real (coincide con el caso de ejemplo del
     punto 10 del requerimiento), texto seleccionable → fixture principal para probar el
     importador de CPE.
   - `fixtures/remitos/remito-yara-fertilizante.pdf` — remito escaneado de Yara
     Argentina (fertilizante a granel), sin capa de texto → fixture para el flujo de
     "adjuntar remito sin CPE", no para parsing automático.
   - `fixtures/excel-historico/camiones-arroz-2026-captura.jpeg` — captura de la
     planilla real "CAMIONES ARROZ 2026". Sirve como referencia visual del formato de
     columnas, pero **no reemplaza al `.xlsx` real**: para la Fase 13 (importador de
     histórico) se sigue necesitando que el usuario aporte el archivo `.xlsx` original.

## 5. Riesgos / puntos a validar durante la construcción (no bloquean el arranque)

- El matching de `lugares` por alias (normalizando mayúsculas/acentos) es crítico para
  que el importador de histórico y el buscador de origen/destino funcionen bien; se debe
  probar contra variantes reales del Excel ("Mojon de Fierro" / "Mijon de Fierro" /
  "MOJON DE FIERRO") en la Fase 13.
  - **Nota de la vista previa del Excel real**: la columna DESTINO también tiene celdas
    vacías en algunas filas con CTG y TN cargados (ej. filas del 18-feb y 2-mar en la
    captura de arroz) — el importador debe permitir destino vacío en la vista previa y
    dejarlo asignable en masa, igual que cliente/camión/chofer.
- La detección de filas de subtotal en el Excel (solo importe en la columna del chofer,
  sin fecha/CTG) se confirmó visualmente en la captura real; el parser debe ignorarlas.
- El parser de texto de la CPE se validó contra un PDF real (`fixtures/cpe`); igual hay
  que tener presente que ARCA podría variar el formato de etiquetas entre lotes de
  emisión, así que el parser debe fallar de forma controlada (mostrar "no se pudo
  detectar X, cargalo a mano") en vez de romper toda la pantalla de revisión.

## 6. Plan de fases

Se respeta el orden y el gate de confirmación manual entre fases definido por el usuario:

1. Setup: repo, Next.js + TS, Supabase, Drizzle, shadcn/ui, layout base, login, estructura
   de carpetas.
2. Esquema completo de base de datos + migraciones + seeds de catálogos.
3. ABMs de catálogos.
4. Tarifario con vigencias.
5. Viajes: alta manual, listado con filtros, detalle con pestañas, máquina de estados.
6. Pesos, merma, tolerancia y alertas.
7. Cálculo de flete, adicionales, comisión y totales.
8. Gastos del viaje, gasoil y cuenta corriente de choferes.
9. Facturación (registro), cobros con imputación y retenciones.
10. Importación de CPE desde PDF/QR (+ fallback Claude) con pantalla de revisión.
11. Liquidaciones a choferes.
12. Dashboard, alertas y reportes con exportación.
13. Importador de datos históricos desde Excel (requiere el `.xlsx` real del usuario).

Cada fase termina con: build + typecheck en verde, demo de lo construido, y pausa para
confirmación del usuario antes de seguir a la siguiente.
