# Importar CPE en tanda (varios archivos de una)

## Contexto

El cliente (Sánchez, transporte de granos) recibe sus CPE/remitos por
WhatsApp y hoy los carga de a uno por `/viajes/importar-cpe`: subir,
esperar la lectura por IA, revisar, confirmar, volver a empezar. Cuando
tiene muchos viajes para cargar de una sentada (por ejemplo, al final del
día o de la semana), ese ciclo completo por archivo es el cuello de
botella, no la lectura de la IA en sí.

No existe forma de que la app reciba archivos directamente desde
WhatsApp (iOS no permite que una app web se registre como destino en su
Share Sheet — ver charla previa a este documento). El punto de entrada
sigue siendo el mismo selector de archivos de siempre; lo único que
cambia es que ahora acepta elegir **varios a la vez**.

## Propósito

Que cargar N viajes desde N archivos tome un repaso rápido por cada uno
en vez de N ciclos completos de subir→esperar→revisar→confirmar→volver.
El usuario debe poder confirmar de un toque los que la IA leyó bien, y
corregir solo los que hagan falta, sin perder de vista cuáles ya quedaron
cargados y cuáles no.

## Alcance

Esta primera etapa cubre únicamente **Importar CPE** (creación de viajes
nuevos). El mecanismo se diseña para que "Importar descarga" y los
comprobantes de Gasoil puedan sumarse después reutilizando el mismo
patrón (cola de procesamiento + checklist + detalle reutilizado), pero
esa extensión queda fuera de esta etapa — no se implementa todavía.

Fuera de alcance también: integración con WhatsApp de cualquier tipo,
procesamiento en paralelo de los archivos (se procesan de a uno, en
orden, para no saturar el límite de la API de la IA), y un límite
explícito de cantidad de archivos por tanda (se prueba con tandas chicas
reales del cliente; si en el uso real hace falta un tope o paginación,
se agrega después con datos concretos en vez de adivinar uno ahora).

## Diseño

### 1. Pantalla nueva: `/viajes/importar-cpe-masivo`

Enlazada desde `/viajes/importar-cpe` y desde el listado de Viajes, al
lado del botón "Importar CPE" existente (que sigue funcionando exactamente
igual que hoy, sin cambios, para cargar una sola CPE).

Flujo:

1. Selector de archivos con `multiple` (mismos tipos aceptados que hoy:
   pdf/jpg/png/heic/heif).
2. Al confirmar la selección, cada archivo pasa a una lista de estado
   visible con: Pendiente → Procesando → Listo / Revisar / Error. Se
   procesan **secuencialmente** llamando a la misma `importarCpe` que ya
   existe hoy — no hay una acción de servidor nueva para "procesar
   varios", el cliente simplemente hace un `await` por archivo en orden y
   actualiza la fila correspondiente a medida que cada uno termina.
3. Cuando termina el último archivo, si hay clientes/choferes/camiones/
   productos/lugares nuevos repetidos entre varias CPE, se muestra **un
   solo panel consolidado** ("Faltan dar de alta N registros" contando
   toda la tanda) antes del checklist. Al confirmarlo, los IDs creados se
   aplican a todas las CPE de la tanda que los necesitaban.
4. Recién ahí aparece el **checklist**: una fila por archivo con Cliente,
   Chofer, Camión, CTG y Fecha. Cada fila tiene "Confirmar" (crea el
   viaje sin salir de la pantalla) y "Ver detalle" (abre el mismo
   formulario completo de revisión que usa hoy Importar CPE, con todos
   los campos editables, scopeado a ese archivo).

### 2. Consolidar "faltan dar de alta" entre varios archivos

Hoy `agruparFaltantes` (en `formulario-revision-cpe.tsx`) dedupe los
faltantes de **una** CPE por tipo+documento/nombre. Se extiende esa
misma lógica para recibir los `faltantes` de **todos** los resultados de
la tanda a la vez, deduplicando igual mismo (un cliente que aparece como
titular en tres CPE distintas sigue dando de alta una sola ficha).

`crearEntidadesFaltantes` (server action existente) no cambia — ya
recibe una lista plana de faltantes. Lo que cambia es que, después de
crearlos, el ID resultante de cada uno se aplica a **todas** las CPE de
la tanda cuyo faltante matcheaba esa huella (hoy solo se aplica a la CPE
actual, porque solo hay una).

### 3. Confirmar sin navegar

`confirmarImportacionCpe` hoy termina con `redirect(/viajes/${id})` — en
la tanda, confirmar una fila no puede sacarte de la pantalla del
checklist. Se separa la lógica interna (crear el viaje, recalcular flete/
merma/liquidación, subir el adjunto) en una función compartida, con dos
wrappers finos:

- `confirmarImportacionCpe` (sin cambios de comportamiento): la usa la
  pantalla de una sola CPE, sigue redirigiendo al viaje creado.
- `confirmarImportacionCpeEnTanda`: la usa el checklist, devuelve
  `{ viajeId }` en vez de redirigir — la fila se marca "Confirmado ✓" y
  el usuario sigue con las demás.

### 4. Reutilización del formulario de detalle

El grid de campos editables de `formulario-revision-cpe.tsx` (todo lo
que va entre el panel de faltantes y los botones de confirmar/cancelar)
se extrae a un componente compartido, parametrizado por `resultado` +
`form` + los catálogos/opciones. Lo usan tanto la pantalla de una sola
CPE (sin cambios visibles) como el "Ver detalle" del checklist en la
tanda. Evita mantener dos copias de la misma grilla de campos.

### 5. Errores y casos límite dentro de la tanda

- **Archivo no procesable** (corrupto, formato no soportado): fila en
  rojo "Error — no se pudo leer", con botón para reintentar ese archivo
  puntual. No bloquea al resto.
- **Extracción dudosa** (`motivoManual` seteado, o `campos_dudosos` no
  vacío en la extracción): fila marcada "Revisar" — el botón "Confirmar"
  de esa fila queda deshabilitado hasta que se abrió el detalle al menos
  una vez, para no crear un viaje casi vacío de un toque por error. El
  resto de las filas (extracción limpia) sí se puede confirmar directo
  desde el checklist.
- **CTG repetido** (entre dos archivos de la misma tanda, o contra un
  viaje ya existente en la base): la fila muestra un aviso ("Ya existe
  el viaje #N con este CTG") pero no bloquea confirmar — el usuario
  decide si es un viaje distinto con el mismo CTG por error de origen o
  si hay que evitarlo. Si en el uso real esto genera duplicados por
  descuido, se endurece a bloqueo más adelante.

### 6. Verificación

Antes de dar la etapa por terminada: probar en producción con archivos
reales del cliente (los que ya se usaron en sesiones anteriores + los de
gasoil/CPE que vayan llegando), subiendo varios juntos, confirmando
algunos, dejando uno con error a propósito, y confirmando que los viajes
se crean correctamente y no se pisan entre sí (mismo estándar de "probar
de verdad, no solo leer código" que se viene usando en todo el proyecto).
