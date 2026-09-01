# Importar descarga en tanda (varios archivos de una)

## Contexto

Igual que con las CPE, el cliente recibe muchos tickets de balanza/notas de
recepción de descarga por WhatsApp y hoy los carga de a uno por
`/viajes/importar-descarga`: subir, esperar la lectura por IA, revisar,
confirmar, volver a empezar. Este documento extiende a Importar descarga
el mismo mecanismo de tanda que ya se construyó para Importar CPE
(`docs/superpowers/specs/2026-08-28-importar-cpe-masivo-design.md`).

A diferencia de CPE, acá **no se crea nada nuevo**: el flujo busca un
viaje ya cargado por CTG y le completa los campos de descarga. Eso hace
que varias partes del mecanismo de CPE no apliquen (no hay "faltan dar de
alta"), y a la vez introduce un caso propio (que la tanda intente
actualizar el mismo viaje dos veces).

## Propósito

Mismo objetivo que la tanda de CPE: repasar rápido varios archivos en vez
de repetir el ciclo completo por cada uno, confirmando de un toque los que
matchearon bien y revisando a mano solo los que hacen falta.

## Alcance

Cubre únicamente Importar descarga (actualizar viajes existentes). Gasoil
queda para una tercera etapa, reutilizando este mismo patrón.

## Diseño

### 1. Pantalla nueva: `/viajes/importar-descarga-masivo`

Mismo patrón que la tanda de CPE: selector de varios archivos (`multiple`,
mismos tipos aceptados que hoy) → procesamiento secuencial contra
`previsualizarImportacionDescarga` (ya existe, sin cambios) → checklist.

Sin panel de faltantes: acá no hay entidades nuevas para dar de alta.

### 2. Extraer el formulario de descarga a un componente compartido

Mismo movimiento que se hizo con `campos-revision-cpe.tsx`: los campos
editables de `formulario-importar-descarga.tsx` (fecha de arribo, fecha de
descarga, N° de turno, pesos, humedad, más el `Alert` de "ya tiene datos
de descarga cargados" con su checkbox de sobrescritura) se extraen a un
componente compartido, para no duplicar esa grilla entre la pantalla de
un solo archivo y el detalle de cada fila de la tanda.

### 3. Estado por fila y acciones

Por archivo procesado:

- **CTG encontrado en un único viaje, sin datos de descarga previos** →
  "Listo": fila con Cliente/Chofer/Camión/CTG del viaje encontrado +
  fecha de descarga leída, con "Confirmar" de un toque y "Ver detalle".
- **CTG no encontrado, o encontrado en más de un viaje (ambiguo)** →
  "Revisar": solo "Ver detalle" (para buscar el viaje a mano o elegir
  entre los encontrados) — mismo criterio que un `motivoManual` en CPE.
- **El viaje encontrado ya tiene fecha de descarga cargada** →
  "Revisar" también, aunque el CTG haya matcheado a un único viaje: nunca
  se sobrescribe de un toque sin que la persona vea qué había antes. El
  detalle muestra el mismo aviso de sobrescritura que ya existe hoy.
- **Dos archivos de la misma tanda resuelven al mismo viaje** (mismo CTG
  repetido, o dos tickets distintos del mismo viaje): aviso ("Ya
  actualizado por otro archivo de esta tanda" / "Otro archivo de esta
  tanda también apunta a este viaje"), no bloquea confirmar.

**Confirmar** llama directo a `actualizarDescargaConAdjunto(viajeId,
formData)` — esa acción ya no redirige hoy, así que no hace falta ninguna
variante "EnTanda" (a diferencia de CPE, donde `confirmarImportacionCpe`
sí redirigía).

### 4. Verificación

Mismo estándar que la tanda de CPE: probar en producción con archivos
reales (tickets ya usados en sesiones anteriores + alguno nuevo si hace
falta), confirmando el caso de CTG ambiguo, el de sobrescritura, y el de
mismo viaje repetido en la tanda, y limpiando cualquier dato de prueba
después.
