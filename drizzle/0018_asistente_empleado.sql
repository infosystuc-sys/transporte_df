-- Félix con permisos según quién le escribe (ver src/lib/asistente/permisos.ts).
-- asistente_empleado: como asistente_lectura (solo lectura, sin login, se toma
-- con SET LOCAL ROLE en una transacción READ ONLY) pero solo con lo operativo:
-- sin tarifas, fletes, facturación, cobros, LP, liquidaciones, adelantos ni lo
-- que cobra cada chofer. Las columnas tienen que coincidir con COLUMNAS_EMPLEADO.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'asistente_empleado') THEN
    CREATE ROLE asistente_empleado NOLOGIN NOINHERIT;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE format('GRANT asistente_empleado TO %I', current_user);
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO asistente_empleado;
--> statement-breakpoint
GRANT SELECT (id, numero, estado, tipo_carga, tiene_cpe, cpe_nro, ctg, cpe_fecha_emision, ctg_vencimiento, campania, remito_nro, declaracion_calidad, cliente_id, camion_id, chofer_id, dominio_tractor, dominio_acoplado, producto_id, origen_id, destino_id, km, fecha_carga, fecha_partida, fecha_arribo, fecha_descarga, n_turno_descarga, bruto_origen, tara_origen, neto_origen, bruto_destino, tara_destino, neto_destino, merma_kg, merma_pct, tolerancia_pct_aplicada, merma_excede_tolerancia, viaje_relacionado_id, observaciones, creado_en, actualizado_en, titular_nombre, titular_cuit, destinatario_nombre, destinatario_cuit, viaje_reemplaza_a_id, humedad_pct, origen_estimado) ON public.viajes TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS viajes_lectura_empleado ON public.viajes;
--> statement-breakpoint
CREATE POLICY viajes_lectura_empleado ON public.viajes AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT (id, razon_social, nombre_fantasia, cuit, direccion, localidad, provincia, telefono, email, contacto, es_dador_carga, es_pagador_flete, activo) ON public.clientes TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS clientes_lectura_empleado ON public.clientes;
--> statement-breakpoint
CREATE POLICY clientes_lectura_empleado ON public.clientes AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT (id, nombre_completo, cuil, dni, telefono, email, direccion, localidad, licencia_nro, licencia_vto, linti_vto, camion_habitual_id, observaciones, activo) ON public.choferes TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS choferes_lectura_empleado ON public.choferes;
--> statement-breakpoint
CREATE POLICY choferes_lectura_empleado ON public.choferes AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT ON public.camiones TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS camiones_lectura_empleado ON public.camiones;
--> statement-breakpoint
CREATE POLICY camiones_lectura_empleado ON public.camiones AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT (id, nombre, tipo, activo) ON public.productos TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS productos_lectura_empleado ON public.productos;
--> statement-breakpoint
CREATE POLICY productos_lectura_empleado ON public.productos AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT ON public.lugares TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS lugares_lectura_empleado ON public.lugares;
--> statement-breakpoint
CREATE POLICY lugares_lectura_empleado ON public.lugares AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT ON public.lugares_alias TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS lugares_alias_lectura_empleado ON public.lugares_alias;
--> statement-breakpoint
CREATE POLICY lugares_alias_lectura_empleado ON public.lugares_alias AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT ON public.estaciones_servicio TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS estaciones_servicio_lectura_empleado ON public.estaciones_servicio;
--> statement-breakpoint
CREATE POLICY estaciones_servicio_lectura_empleado ON public.estaciones_servicio AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT ON public.cargas_gasoil TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS cargas_gasoil_lectura_empleado ON public.cargas_gasoil;
--> statement-breakpoint
CREATE POLICY cargas_gasoil_lectura_empleado ON public.cargas_gasoil AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT ON public.viaje_gastos TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS viaje_gastos_lectura_empleado ON public.viaje_gastos;
--> statement-breakpoint
CREATE POLICY viaje_gastos_lectura_empleado ON public.viaje_gastos AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT ON public.viaje_contingencias TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS viaje_contingencias_lectura_empleado ON public.viaje_contingencias;
--> statement-breakpoint
CREATE POLICY viaje_contingencias_lectura_empleado ON public.viaje_contingencias AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT ON public.tipos_gasto TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS tipos_gasto_lectura_empleado ON public.tipos_gasto;
--> statement-breakpoint
CREATE POLICY tipos_gasto_lectura_empleado ON public.tipos_gasto AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
GRANT SELECT ON public.tipos_contingencia TO asistente_empleado;
--> statement-breakpoint
DROP POLICY IF EXISTS tipos_contingencia_lectura_empleado ON public.tipos_contingencia;
--> statement-breakpoint
CREATE POLICY tipos_contingencia_lectura_empleado ON public.tipos_contingencia AS PERMISSIVE FOR SELECT TO asistente_empleado USING (true);
--> statement-breakpoint
-- El registro de Félix lo pueden consultar los admin ("¿qué cargaste hoy?").
GRANT SELECT ON public.asistente_registro TO asistente_lectura;
--> statement-breakpoint
DROP POLICY IF EXISTS asistente_registro_lectura_asistente ON public.asistente_registro;
--> statement-breakpoint
CREATE POLICY asistente_registro_lectura_asistente ON public.asistente_registro AS PERMISSIVE FOR SELECT TO asistente_lectura USING (true);
