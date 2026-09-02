# Gasoil en tanda (varios comprobantes de una)

## Contexto

Tercer y último flujo de la serie "en tanda" (después de
[Importar CPE en tanda](2026-08-28-importar-cpe-masivo-design.md) e
[Importar descarga en tanda](2026-08-30-importar-descarga-masivo-design.md)):
el cliente recibe varios comprobantes de carga de combustible por WhatsApp
(facturas de surtidor, tickets de estación) y hoy los carga de a uno en
`/gasoil` con el botón "Cargar por IA".

A diferencia de CPE (crea un viaje nuevo) y Descarga (actualiza un viaje
existente por CTG), Gasoil no tiene un dato equivalente al CTG para
"encontrar lo que ya existe": cada comprobante da de alta una carga de
combustible nueva e independiente, igual que CPE crea un viaje nuevo, pero
sin la fase de "faltantes" de CPE — acá nunca se crea un camión o chofer
nuevo desde este flujo (regla ya vigente en la pantalla de un solo archivo:
el matching de patente/chofer solo completa el formulario si encuentra una
coincidencia exacta en el catálogo existente, nunca ofrece dar de alta).

## Propósito

Mismo objetivo que los otros dos: repasar varios comprobantes rápido,
confirmando de un toque los que matchearon bien y revisando a mano solo
los que hacen falta.

## Alcance

Cubre únicamente el módulo `/gasoil` (carga de combustible de la flota).
No incluye la pestaña "Gastos" de cada viaje individual, que usa el mismo
botón "Cargar por IA" pero para otro tipo de comprobantes (peajes,
estadías, gastos varios) — es un flujo distinto, fuera de esta serie.

No se modifica la extracción por IA de comprobantes (`src/lib/comprobantes/claude.ts`)
ni se le agrega nada nuevo — sigue exactamente como está hoy.

## Diseño

### 1. Pantalla nueva: `/gasoil-masivo`

Mismo patrón que CPE y Descarga: selector de varios archivos (`multiple`,
mismos tipos aceptados que hoy en Gasoil) → procesamiento secuencial contra
`previsualizarComprobante` (ya existe, sin cambios) → checklist.

Sin panel de faltantes (no aplica: acá nunca se da de alta nada además de
la carga de gasoil en sí).

### 2. Extraer el formulario de gasoil a un componente compartido

Mismo movimiento que ya se hizo con `campos-revision-cpe.tsx` y
`campos-revision-descarga.tsx`: los campos editables hoy inline dentro del
`campos={(form) => (...)}` de `gestor-gasoil.tsx` (fecha, camión, chofer,
estación, viaje, litros, precio, importe, odómetro, modalidad, rendido,
comprobante N°, observaciones) se extraen a un componente compartido, para
reutilizarlos en el detalle de cada fila de la tanda sin duplicar la
grilla. El ABM de `/gasoil` pasa a consumir ese mismo componente.

### 3. Estado por fila y acciones

Por archivo procesado:

- **Patente matchea un único camión existente** → "Listo": fila con
  camión/chofer (si matcheó)/litros/importe leídos, con "Confirmar" de un
  toque (modalidad de pago precargada en "Cuenta corriente", editable en
  el detalle) y "Ver detalle".
- **Patente no matchea ningún camión, o el comprobante no trae patente
  legible** → "Revisar": solo "Ver detalle", donde hay que elegir un
  camión de la lista ya cargada antes de poder confirmar. Nunca se ofrece
  dar de alta un camión nuevo desde acá — si el camión no existe todavía,
  hay que cargarlo primero en Camiones y volver a intentar.
- **Chofer no matcheado**: no bloquea nada — el campo queda vacío,
  editable en el detalle en cualquier momento (igual que en la pantalla
  de un solo archivo hoy).
- **Dos archivos de la tanda matchean el mismo camión y tienen la misma
  fecha leída del comprobante** (el campo `fecha` que devuelve la IA, no
  la fecha de hoy ni la de subida) → aviso de posible duplicado ("Otro
  archivo de esta tanda también apunta a este camión en la misma fecha"),
  no bloquea confirmar — pedido explícito del cliente, mismo criterio
  "avisar, no bloquear" ya usado en CPE y Descarga. Si la fecha no se
  pudo leer en alguno de los dos, no se compara (no hay base para avisar).

**Confirmar** llama directo a `crearCargaGasoilConAdjunto(formData)` — esa
acción ya no redirige hoy, así que no hace falta ninguna variante "EnTanda"
(igual que en Descarga).

`cargaGasoilSchema` SÍ tiene campos obligatorios (`camion_id`, `litros`,
`fecha`, `modalidad`, y `importe` condicional si `modalidad ===
"pagado_por_chofer"`) — a diferencia de Descarga, el "Confirmar" de un
toque de esta tanda necesita el mismo guard de `safeParse`-antes-de-confirmar
que ya tiene CPE: si falla, no se confirma nada y se abre el detalle de
esa fila para completar a mano lo que falte (mismo comportamiento que
`confirmarRapido` en CPE en tanda ante un `cliente_id` sin resolver).

### 4. Verificación

Mismo estándar que las dos tandas anteriores: probar en producción con
comprobantes reales del cliente (facturas y tickets, de ser posible con
distintas patentes para separar el caso "matchea" del caso "no matchea"),
confirmando el aviso de duplicado (mismo camión + misma fecha) y el
bloqueo de camión-no-encontrado, y sin dejar datos de prueba sueltos al
terminar.
