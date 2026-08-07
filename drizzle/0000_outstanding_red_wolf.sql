CREATE TYPE "public"."a_cargo" AS ENUM('cliente', 'empresa');--> statement-breakpoint
CREATE TYPE "public"."base_calculo_cliente" AS ENUM('origen', 'destino', 'heredar');--> statement-breakpoint
CREATE TYPE "public"."base_calculo" AS ENUM('origen', 'destino');--> statement-breakpoint
CREATE TYPE "public"."declaracion_calidad" AS ENUM('conforme', 'condicional');--> statement-breakpoint
CREATE TYPE "public"."entidad_adjunto" AS ENUM('viaje', 'cobro', 'carga_gasoil', 'liquidacion');--> statement-breakpoint
CREATE TYPE "public"."estado_viaje" AS ENUM('planificado', 'cargado', 'en_transito', 'descargado', 'facturado', 'cobrado', 'liquidado');--> statement-breakpoint
CREATE TYPE "public"."modalidad_gasoil" AS ENUM('cuenta_corriente', 'pagado_por_chofer');--> statement-breakpoint
CREATE TYPE "public"."modalidad_pago_chofer" AS ENUM('porcentaje_flete', 'monto_fijo_viaje', 'por_tonelada', 'sueldo', 'sin_definir');--> statement-breakpoint
CREATE TYPE "public"."modalidad_tarifa" AS ENUM('por_tonelada', 'por_km', 'por_tonelada_km', 'monto_fijo');--> statement-breakpoint
CREATE TYPE "public"."pagado_por" AS ENUM('empresa', 'chofer');--> statement-breakpoint
CREATE TYPE "public"."tipo_adjunto" AS ENUM('cpe_pdf', 'ticket_balanza', 'remito', 'factura', 'comprobante', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_carga" AS ENUM('grano', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_lugar" AS ENUM('campo', 'planta', 'acopio', 'puerto', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento_chofer" AS ENUM('adelanto', 'gasoil', 'gasto_rendido', 'liquidacion', 'devolucion', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."tipo_producto" AS ENUM('grano', 'fertilizante', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_retencion" AS ENUM('ganancias', 'iibb', 'iva', 'sicore', 'otro');--> statement-breakpoint
CREATE TYPE "public"."unidad_carga" AS ENUM('toneladas', 'kilogramos');--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rol" text DEFAULT 'admin' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "condiciones_pago" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "condiciones_pago_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"dias" integer,
	"observaciones" text
);
--> statement-breakpoint
ALTER TABLE "condiciones_pago" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "configuracion" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "configuracion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"razon_social" text,
	"cuit" text,
	"direccion" text,
	"telefono" text,
	"email" text,
	"logo_url" text,
	"tolerancia_merma_pct" numeric(6, 3) DEFAULT '0.5',
	"base_calculo_flete_default" "base_calculo" DEFAULT 'destino',
	"modalidad_tarifa_default" "modalidad_tarifa" DEFAULT 'por_tonelada',
	"unidad_carga_default" "unidad_carga" DEFAULT 'toneladas',
	"porcentaje_chofer_default" numeric(6, 3) DEFAULT '15',
	"alerta_ctg_horas" integer DEFAULT 24,
	"alerta_vencimientos_dias" integer DEFAULT 30
);
--> statement-breakpoint
ALTER TABLE "configuracion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estaciones_servicio" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "estaciones_servicio_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"localidad" text,
	"provincia" text,
	"tiene_cuenta_corriente" boolean DEFAULT false NOT NULL,
	"observaciones" text,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "estaciones_servicio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medios_pago" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "medios_pago_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"requiere_datos_cheque" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medios_pago" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "productos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "productos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"tipo" "tipo_producto",
	"precio_referencia" numeric(14, 2),
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "productos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tipos_adicional" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tipos_adicional_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"a_cargo_default" "a_cargo",
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tipos_adicional" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tipos_contingencia" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tipos_contingencia_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tipos_contingencia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tipos_gasto" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tipos_gasto_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tipos_gasto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clientes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"razon_social" text NOT NULL,
	"nombre_fantasia" text,
	"cuit" text,
	"condicion_iva" text,
	"direccion" text,
	"localidad" text,
	"provincia" text,
	"telefono" text,
	"email" text,
	"contacto" text,
	"es_dador_carga" boolean DEFAULT false NOT NULL,
	"es_pagador_flete" boolean DEFAULT false NOT NULL,
	"condicion_pago_id" bigint,
	"base_calculo_flete" "base_calculo_cliente" DEFAULT 'heredar',
	"tolerancia_merma_pct" numeric(6, 3),
	"observaciones" text,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lugares" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lugares_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"tipo" "tipo_lugar",
	"localidad" text,
	"provincia" text,
	"direccion" text,
	"n_planta" text,
	"renspa" text,
	"latitud" double precision,
	"longitud" double precision,
	"cliente_id" bigint,
	"observaciones" text,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lugares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lugares_alias" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lugares_alias_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lugar_id" bigint NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lugares_alias" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "camiones" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "camiones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"dominio_tractor" text NOT NULL,
	"dominio_acoplado" text,
	"marca" text,
	"modelo" text,
	"anio" integer,
	"n_chasis" text,
	"n_motor" text,
	"titular" text,
	"tara_kg" integer,
	"capacidad_kg" integer,
	"vto_vtv" timestamp with time zone,
	"vto_seguro" timestamp with time zone,
	"aseguradora" text,
	"poliza" text,
	"vto_ruta" timestamp with time zone,
	"vto_cnrt" timestamp with time zone,
	"vto_senasa" timestamp with time zone,
	"odometro_actual" integer,
	"observaciones" text,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "camiones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "choferes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "choferes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre_completo" text NOT NULL,
	"cuil" text,
	"dni" text,
	"telefono" text,
	"email" text,
	"direccion" text,
	"localidad" text,
	"licencia_nro" text,
	"licencia_vto" timestamp with time zone,
	"linti_vto" timestamp with time zone,
	"modalidad_pago" "modalidad_pago_chofer" DEFAULT 'porcentaje_flete',
	"valor_pago" numeric(14, 2) DEFAULT '15',
	"camion_habitual_id" bigint,
	"observaciones" text,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "choferes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tarifas" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tarifas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cliente_id" bigint NOT NULL,
	"origen_id" bigint,
	"destino_id" bigint,
	"producto_id" bigint,
	"km" integer,
	"modalidad_tarifa" "modalidad_tarifa",
	"valor" numeric(14, 2) NOT NULL,
	"vigencia_desde" timestamp with time zone NOT NULL,
	"vigencia_hasta" timestamp with time zone,
	"activo" boolean DEFAULT true NOT NULL,
	"observaciones" text
);
--> statement-breakpoint
ALTER TABLE "tarifas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "viaje_adicionales" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "viaje_adicionales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"viaje_id" bigint NOT NULL,
	"tipo_adicional_id" bigint NOT NULL,
	"descripcion" text,
	"importe" numeric(14, 2) NOT NULL,
	"a_cargo_de" "a_cargo"
);
--> statement-breakpoint
ALTER TABLE "viaje_adicionales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "viaje_contingencias" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "viaje_contingencias_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"viaje_id" bigint NOT NULL,
	"tipo_contingencia_id" bigint,
	"descripcion" text,
	"fecha" timestamp with time zone,
	"es_desactivacion" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "viaje_contingencias" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "viaje_gastos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "viaje_gastos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"viaje_id" bigint NOT NULL,
	"tipo_gasto_id" bigint NOT NULL,
	"fecha" timestamp with time zone,
	"importe" numeric(14, 2) NOT NULL,
	"pagado_por" "pagado_por",
	"medio_pago_id" bigint,
	"comprobante_nro" text,
	"rendido" boolean DEFAULT false NOT NULL,
	"observaciones" text
);
--> statement-breakpoint
ALTER TABLE "viaje_gastos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "viajes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "viajes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"numero" integer GENERATED ALWAYS AS IDENTITY (sequence name "viajes_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"estado" "estado_viaje" DEFAULT 'planificado' NOT NULL,
	"tipo_carga" "tipo_carga" DEFAULT 'grano' NOT NULL,
	"tiene_cpe" boolean DEFAULT true NOT NULL,
	"cpe_nro" text,
	"ctg" text,
	"cpe_fecha_emision" timestamp with time zone,
	"ctg_vencimiento" timestamp with time zone,
	"campania" text,
	"remito_nro" text,
	"declaracion_calidad" "declaracion_calidad",
	"cliente_id" bigint NOT NULL,
	"pagador_id" bigint,
	"destinatario_id" bigint,
	"intermediario_id" bigint,
	"comision_intermediario_pct" numeric(6, 3),
	"camion_id" bigint,
	"chofer_id" bigint,
	"dominio_tractor" text,
	"dominio_acoplado" text,
	"producto_id" bigint,
	"origen_id" bigint,
	"destino_id" bigint,
	"km" integer,
	"fecha_carga" timestamp with time zone,
	"fecha_partida" timestamp with time zone,
	"fecha_arribo" timestamp with time zone,
	"fecha_descarga" timestamp with time zone,
	"n_turno_descarga" text,
	"bruto_origen" numeric(12, 2),
	"tara_origen" numeric(12, 2),
	"neto_origen" numeric(12, 2),
	"bruto_destino" numeric(12, 2),
	"tara_destino" numeric(12, 2),
	"neto_destino" numeric(12, 2),
	"merma_kg" numeric(12, 2),
	"merma_pct" numeric(6, 3),
	"tolerancia_pct_aplicada" numeric(6, 3),
	"merma_excede_tolerancia" boolean DEFAULT false NOT NULL,
	"merma_precio_unitario" numeric(14, 2),
	"merma_importe" numeric(14, 2),
	"modalidad_tarifa" "modalidad_tarifa",
	"valor_tarifa" numeric(14, 2),
	"tarifa_id" bigint,
	"base_calculo" "base_calculo",
	"importe_flete" numeric(14, 2),
	"importe_adicionales" numeric(14, 2),
	"importe_comision" numeric(14, 2),
	"total_a_cobrar" numeric(14, 2),
	"facturado" boolean DEFAULT false NOT NULL,
	"factura_nro" text,
	"factura_fecha" timestamp with time zone,
	"factura_importe_neto" numeric(14, 2),
	"factura_iva" numeric(14, 2),
	"factura_importe_total" numeric(14, 2),
	"condicion_pago_id" bigint,
	"fecha_vto_cobro" timestamp with time zone,
	"importe_cobrado" numeric(14, 2),
	"saldo_pendiente" numeric(14, 2),
	"liquidado" boolean DEFAULT false NOT NULL,
	"liquidacion_id" bigint,
	"importe_liquidacion_chofer" numeric(14, 2),
	"viaje_relacionado_id" bigint,
	"observaciones" text,
	"importado_de_excel" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "viajes_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
ALTER TABLE "viajes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "adjuntos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "adjuntos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entidad" "entidad_adjunto" NOT NULL,
	"entidad_id" bigint NOT NULL,
	"tipo" "tipo_adjunto" NOT NULL,
	"nombre_archivo" text,
	"storage_path" text NOT NULL,
	"subido_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adjuntos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cargas_gasoil" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cargas_gasoil_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"fecha" timestamp with time zone NOT NULL,
	"camion_id" bigint NOT NULL,
	"chofer_id" bigint,
	"viaje_id" bigint,
	"estacion_id" bigint,
	"litros" numeric(10, 2) NOT NULL,
	"precio_litro" numeric(14, 2),
	"importe" numeric(14, 2) NOT NULL,
	"odometro" integer NOT NULL,
	"modalidad" "modalidad_gasoil" NOT NULL,
	"rendido" boolean,
	"comprobante_nro" text,
	"observaciones" text
);
--> statement-breakpoint
ALTER TABLE "cargas_gasoil" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cobro_imputaciones" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cobro_imputaciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cobro_id" bigint NOT NULL,
	"viaje_id" bigint NOT NULL,
	"importe_imputado" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cobro_imputaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cobros" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cobros_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"fecha" timestamp with time zone NOT NULL,
	"cliente_id" bigint NOT NULL,
	"medio_pago_id" bigint NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"referencia" text,
	"banco" text,
	"cheque_nro" text,
	"cheque_vto" timestamp with time zone,
	"observaciones" text
);
--> statement-breakpoint
ALTER TABLE "cobros" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "retenciones_cobro" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "retenciones_cobro_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cobro_id" bigint NOT NULL,
	"tipo" "tipo_retencion" NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"certificado_nro" text
);
--> statement-breakpoint
ALTER TABLE "retenciones_cobro" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "liquidacion_viajes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "liquidacion_viajes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"liquidacion_id" bigint NOT NULL,
	"viaje_id" bigint NOT NULL,
	"importe" numeric(14, 2)
);
--> statement-breakpoint
ALTER TABLE "liquidacion_viajes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "liquidaciones_chofer" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "liquidaciones_chofer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"chofer_id" bigint NOT NULL,
	"periodo_desde" timestamp with time zone,
	"periodo_hasta" timestamp with time zone,
	"fecha" timestamp with time zone NOT NULL,
	"total_viajes" integer,
	"total_adelantos" numeric(14, 2),
	"total_neto" numeric(14, 2),
	"pagado" boolean DEFAULT false NOT NULL,
	"medio_pago_id" bigint,
	"observaciones" text
);
--> statement-breakpoint
ALTER TABLE "liquidaciones_chofer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movimientos_chofer" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "movimientos_chofer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"fecha" timestamp with time zone NOT NULL,
	"chofer_id" bigint NOT NULL,
	"tipo" "tipo_movimiento_chofer" NOT NULL,
	"medio_pago_id" bigint,
	"importe" numeric(14, 2) NOT NULL,
	"viaje_id" bigint,
	"origen_automatico" boolean DEFAULT false NOT NULL,
	"descripcion" text
);
--> statement-breakpoint
ALTER TABLE "movimientos_chofer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_condicion_pago_id_condiciones_pago_id_fk" FOREIGN KEY ("condicion_pago_id") REFERENCES "public"."condiciones_pago"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lugares" ADD CONSTRAINT "lugares_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lugares_alias" ADD CONSTRAINT "lugares_alias_lugar_id_lugares_id_fk" FOREIGN KEY ("lugar_id") REFERENCES "public"."lugares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choferes" ADD CONSTRAINT "choferes_camion_habitual_id_camiones_id_fk" FOREIGN KEY ("camion_habitual_id") REFERENCES "public"."camiones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_origen_id_lugares_id_fk" FOREIGN KEY ("origen_id") REFERENCES "public"."lugares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_destino_id_lugares_id_fk" FOREIGN KEY ("destino_id") REFERENCES "public"."lugares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viaje_adicionales" ADD CONSTRAINT "viaje_adicionales_viaje_id_viajes_id_fk" FOREIGN KEY ("viaje_id") REFERENCES "public"."viajes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viaje_adicionales" ADD CONSTRAINT "viaje_adicionales_tipo_adicional_id_tipos_adicional_id_fk" FOREIGN KEY ("tipo_adicional_id") REFERENCES "public"."tipos_adicional"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viaje_contingencias" ADD CONSTRAINT "viaje_contingencias_viaje_id_viajes_id_fk" FOREIGN KEY ("viaje_id") REFERENCES "public"."viajes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viaje_contingencias" ADD CONSTRAINT "viaje_contingencias_tipo_contingencia_id_tipos_contingencia_id_fk" FOREIGN KEY ("tipo_contingencia_id") REFERENCES "public"."tipos_contingencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viaje_gastos" ADD CONSTRAINT "viaje_gastos_viaje_id_viajes_id_fk" FOREIGN KEY ("viaje_id") REFERENCES "public"."viajes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viaje_gastos" ADD CONSTRAINT "viaje_gastos_tipo_gasto_id_tipos_gasto_id_fk" FOREIGN KEY ("tipo_gasto_id") REFERENCES "public"."tipos_gasto"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viaje_gastos" ADD CONSTRAINT "viaje_gastos_medio_pago_id_medios_pago_id_fk" FOREIGN KEY ("medio_pago_id") REFERENCES "public"."medios_pago"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_pagador_id_clientes_id_fk" FOREIGN KEY ("pagador_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_destinatario_id_clientes_id_fk" FOREIGN KEY ("destinatario_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_intermediario_id_clientes_id_fk" FOREIGN KEY ("intermediario_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_camion_id_camiones_id_fk" FOREIGN KEY ("camion_id") REFERENCES "public"."camiones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_chofer_id_choferes_id_fk" FOREIGN KEY ("chofer_id") REFERENCES "public"."choferes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_origen_id_lugares_id_fk" FOREIGN KEY ("origen_id") REFERENCES "public"."lugares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_destino_id_lugares_id_fk" FOREIGN KEY ("destino_id") REFERENCES "public"."lugares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_tarifa_id_tarifas_id_fk" FOREIGN KEY ("tarifa_id") REFERENCES "public"."tarifas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_condicion_pago_id_condiciones_pago_id_fk" FOREIGN KEY ("condicion_pago_id") REFERENCES "public"."condiciones_pago"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargas_gasoil" ADD CONSTRAINT "cargas_gasoil_camion_id_camiones_id_fk" FOREIGN KEY ("camion_id") REFERENCES "public"."camiones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargas_gasoil" ADD CONSTRAINT "cargas_gasoil_chofer_id_choferes_id_fk" FOREIGN KEY ("chofer_id") REFERENCES "public"."choferes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargas_gasoil" ADD CONSTRAINT "cargas_gasoil_viaje_id_viajes_id_fk" FOREIGN KEY ("viaje_id") REFERENCES "public"."viajes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargas_gasoil" ADD CONSTRAINT "cargas_gasoil_estacion_id_estaciones_servicio_id_fk" FOREIGN KEY ("estacion_id") REFERENCES "public"."estaciones_servicio"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobro_imputaciones" ADD CONSTRAINT "cobro_imputaciones_cobro_id_cobros_id_fk" FOREIGN KEY ("cobro_id") REFERENCES "public"."cobros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobro_imputaciones" ADD CONSTRAINT "cobro_imputaciones_viaje_id_viajes_id_fk" FOREIGN KEY ("viaje_id") REFERENCES "public"."viajes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_medio_pago_id_medios_pago_id_fk" FOREIGN KEY ("medio_pago_id") REFERENCES "public"."medios_pago"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retenciones_cobro" ADD CONSTRAINT "retenciones_cobro_cobro_id_cobros_id_fk" FOREIGN KEY ("cobro_id") REFERENCES "public"."cobros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion_viajes" ADD CONSTRAINT "liquidacion_viajes_liquidacion_id_liquidaciones_chofer_id_fk" FOREIGN KEY ("liquidacion_id") REFERENCES "public"."liquidaciones_chofer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion_viajes" ADD CONSTRAINT "liquidacion_viajes_viaje_id_viajes_id_fk" FOREIGN KEY ("viaje_id") REFERENCES "public"."viajes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones_chofer" ADD CONSTRAINT "liquidaciones_chofer_chofer_id_choferes_id_fk" FOREIGN KEY ("chofer_id") REFERENCES "public"."choferes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones_chofer" ADD CONSTRAINT "liquidaciones_chofer_medio_pago_id_medios_pago_id_fk" FOREIGN KEY ("medio_pago_id") REFERENCES "public"."medios_pago"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_chofer" ADD CONSTRAINT "movimientos_chofer_chofer_id_choferes_id_fk" FOREIGN KEY ("chofer_id") REFERENCES "public"."choferes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_chofer" ADD CONSTRAINT "movimientos_chofer_medio_pago_id_medios_pago_id_fk" FOREIGN KEY ("medio_pago_id") REFERENCES "public"."medios_pago"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_chofer" ADD CONSTRAINT "movimientos_chofer_viaje_id_viajes_id_fk" FOREIGN KEY ("viaje_id") REFERENCES "public"."viajes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clientes_condicion_pago_id_idx" ON "clientes" USING btree ("condicion_pago_id");--> statement-breakpoint
CREATE INDEX "lugares_cliente_id_idx" ON "lugares" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "lugares_alias_lugar_id_idx" ON "lugares_alias" USING btree ("lugar_id");--> statement-breakpoint
CREATE INDEX "choferes_camion_habitual_id_idx" ON "choferes" USING btree ("camion_habitual_id");--> statement-breakpoint
CREATE INDEX "tarifas_cliente_id_idx" ON "tarifas" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "tarifas_origen_id_idx" ON "tarifas" USING btree ("origen_id");--> statement-breakpoint
CREATE INDEX "tarifas_destino_id_idx" ON "tarifas" USING btree ("destino_id");--> statement-breakpoint
CREATE INDEX "tarifas_producto_id_idx" ON "tarifas" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX "viaje_adicionales_viaje_id_idx" ON "viaje_adicionales" USING btree ("viaje_id");--> statement-breakpoint
CREATE INDEX "viaje_adicionales_tipo_adicional_id_idx" ON "viaje_adicionales" USING btree ("tipo_adicional_id");--> statement-breakpoint
CREATE INDEX "viaje_contingencias_viaje_id_idx" ON "viaje_contingencias" USING btree ("viaje_id");--> statement-breakpoint
CREATE INDEX "viaje_contingencias_tipo_contingencia_id_idx" ON "viaje_contingencias" USING btree ("tipo_contingencia_id");--> statement-breakpoint
CREATE INDEX "viaje_gastos_viaje_id_idx" ON "viaje_gastos" USING btree ("viaje_id");--> statement-breakpoint
CREATE INDEX "viaje_gastos_tipo_gasto_id_idx" ON "viaje_gastos" USING btree ("tipo_gasto_id");--> statement-breakpoint
CREATE INDEX "viaje_gastos_medio_pago_id_idx" ON "viaje_gastos" USING btree ("medio_pago_id");--> statement-breakpoint
CREATE INDEX "viajes_cliente_id_idx" ON "viajes" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "viajes_pagador_id_idx" ON "viajes" USING btree ("pagador_id");--> statement-breakpoint
CREATE INDEX "viajes_destinatario_id_idx" ON "viajes" USING btree ("destinatario_id");--> statement-breakpoint
CREATE INDEX "viajes_intermediario_id_idx" ON "viajes" USING btree ("intermediario_id");--> statement-breakpoint
CREATE INDEX "viajes_camion_id_idx" ON "viajes" USING btree ("camion_id");--> statement-breakpoint
CREATE INDEX "viajes_chofer_id_idx" ON "viajes" USING btree ("chofer_id");--> statement-breakpoint
CREATE INDEX "viajes_producto_id_idx" ON "viajes" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX "viajes_origen_id_idx" ON "viajes" USING btree ("origen_id");--> statement-breakpoint
CREATE INDEX "viajes_destino_id_idx" ON "viajes" USING btree ("destino_id");--> statement-breakpoint
CREATE INDEX "viajes_tarifa_id_idx" ON "viajes" USING btree ("tarifa_id");--> statement-breakpoint
CREATE INDEX "viajes_condicion_pago_id_idx" ON "viajes" USING btree ("condicion_pago_id");--> statement-breakpoint
CREATE INDEX "viajes_liquidacion_id_idx" ON "viajes" USING btree ("liquidacion_id");--> statement-breakpoint
CREATE INDEX "viajes_estado_idx" ON "viajes" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "adjuntos_entidad_entidad_id_idx" ON "adjuntos" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "cargas_gasoil_camion_id_idx" ON "cargas_gasoil" USING btree ("camion_id");--> statement-breakpoint
CREATE INDEX "cargas_gasoil_chofer_id_idx" ON "cargas_gasoil" USING btree ("chofer_id");--> statement-breakpoint
CREATE INDEX "cargas_gasoil_viaje_id_idx" ON "cargas_gasoil" USING btree ("viaje_id");--> statement-breakpoint
CREATE INDEX "cargas_gasoil_estacion_id_idx" ON "cargas_gasoil" USING btree ("estacion_id");--> statement-breakpoint
CREATE INDEX "cobro_imputaciones_cobro_id_idx" ON "cobro_imputaciones" USING btree ("cobro_id");--> statement-breakpoint
CREATE INDEX "cobro_imputaciones_viaje_id_idx" ON "cobro_imputaciones" USING btree ("viaje_id");--> statement-breakpoint
CREATE INDEX "cobros_cliente_id_idx" ON "cobros" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "cobros_medio_pago_id_idx" ON "cobros" USING btree ("medio_pago_id");--> statement-breakpoint
CREATE INDEX "retenciones_cobro_cobro_id_idx" ON "retenciones_cobro" USING btree ("cobro_id");--> statement-breakpoint
CREATE INDEX "liquidacion_viajes_liquidacion_id_idx" ON "liquidacion_viajes" USING btree ("liquidacion_id");--> statement-breakpoint
CREATE INDEX "liquidacion_viajes_viaje_id_idx" ON "liquidacion_viajes" USING btree ("viaje_id");--> statement-breakpoint
CREATE INDEX "liquidaciones_chofer_chofer_id_idx" ON "liquidaciones_chofer" USING btree ("chofer_id");--> statement-breakpoint
CREATE INDEX "liquidaciones_chofer_medio_pago_id_idx" ON "liquidaciones_chofer" USING btree ("medio_pago_id");--> statement-breakpoint
CREATE INDEX "movimientos_chofer_chofer_id_idx" ON "movimientos_chofer" USING btree ("chofer_id");--> statement-breakpoint
CREATE INDEX "movimientos_chofer_medio_pago_id_idx" ON "movimientos_chofer" USING btree ("medio_pago_id");--> statement-breakpoint
CREATE INDEX "movimientos_chofer_viaje_id_idx" ON "movimientos_chofer" USING btree ("viaje_id");--> statement-breakpoint
CREATE POLICY "usuarios_acceso_total_autenticados" ON "usuarios" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "condiciones_pago_acceso_total_autenticados" ON "condiciones_pago" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "configuracion_acceso_total_autenticados" ON "configuracion" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "estaciones_servicio_acceso_total_autenticados" ON "estaciones_servicio" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "medios_pago_acceso_total_autenticados" ON "medios_pago" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "productos_acceso_total_autenticados" ON "productos" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "tipos_adicional_acceso_total_autenticados" ON "tipos_adicional" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "tipos_contingencia_acceso_total_autenticados" ON "tipos_contingencia" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "tipos_gasto_acceso_total_autenticados" ON "tipos_gasto" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "clientes_acceso_total_autenticados" ON "clientes" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "lugares_acceso_total_autenticados" ON "lugares" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "lugares_alias_acceso_total_autenticados" ON "lugares_alias" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "camiones_acceso_total_autenticados" ON "camiones" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "choferes_acceso_total_autenticados" ON "choferes" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "tarifas_acceso_total_autenticados" ON "tarifas" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "viaje_adicionales_acceso_total_autenticados" ON "viaje_adicionales" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "viaje_contingencias_acceso_total_autenticados" ON "viaje_contingencias" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "viaje_gastos_acceso_total_autenticados" ON "viaje_gastos" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "viajes_acceso_total_autenticados" ON "viajes" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "adjuntos_acceso_total_autenticados" ON "adjuntos" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "cargas_gasoil_acceso_total_autenticados" ON "cargas_gasoil" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "cobro_imputaciones_acceso_total_autenticados" ON "cobro_imputaciones" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "cobros_acceso_total_autenticados" ON "cobros" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "retenciones_cobro_acceso_total_autenticados" ON "retenciones_cobro" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "liquidacion_viajes_acceso_total_autenticados" ON "liquidacion_viajes" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "liquidaciones_chofer_acceso_total_autenticados" ON "liquidaciones_chofer" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "movimientos_chofer_acceso_total_autenticados" ON "movimientos_chofer" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);