-- Rol de solo lectura para Félix, el asistente de la app.
-- No puede iniciar sesión: el servidor lo toma con SET LOCAL ROLE dentro de
-- una transacción READ ONLY para cada consulta que arma Félix, así solo ve
-- las tablas de negocio de abajo (no usuarios ni adjuntos) y nunca escribe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'asistente_lectura') THEN
    CREATE ROLE asistente_lectura NOLOGIN NOINHERIT;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE format('GRANT asistente_lectura TO %I', current_user);
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO asistente_lectura;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'viajes', 'viaje_adicionales', 'viaje_gastos', 'viaje_contingencias',
    'clientes', 'choferes', 'camiones', 'lugares', 'lugares_alias', 'productos',
    'tarifas', 'condiciones_pago', 'medios_pago', 'tipos_adicional', 'tipos_gasto',
    'tipos_contingencia', 'estaciones_servicio', 'cargas_gasoil',
    'movimientos_chofer', 'liquidaciones_chofer', 'liquidacion_viajes',
    'cobros', 'cobro_imputaciones', 'retenciones_cobro',
    'liquidos_producto', 'liquido_producto_lineas', 'liquido_producto_cobros'
  ]
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO asistente_lectura', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_lectura_asistente', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO asistente_lectura USING (true)',
      t || '_lectura_asistente', t
    );
  END LOOP;
END $$;
