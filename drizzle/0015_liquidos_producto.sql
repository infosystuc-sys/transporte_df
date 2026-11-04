CREATE TABLE "liquido_producto_cobros" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "liquido_producto_cobros_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"liquido_producto_id" bigint NOT NULL,
	"cobro_id" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "liquido_producto_cobros" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "liquido_producto_lineas" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "liquido_producto_lineas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"liquido_producto_id" bigint NOT NULL,
	"ctg" text NOT NULL,
	"viaje_id" bigint,
	"kg" numeric(12, 2),
	"tarifa" numeric(14, 2),
	"km" integer,
	"flete" numeric(14, 2) NOT NULL,
	"comision" numeric(14, 2) NOT NULL,
	"otros_descuentos" numeric(14, 2) NOT NULL,
	"neto" numeric(14, 2) NOT NULL,
	"iva" numeric(14, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"aviso" text
);
--> statement-breakpoint
ALTER TABLE "liquido_producto_lineas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "liquidos_producto" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "liquidos_producto_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cliente_id" bigint NOT NULL,
	"numero" text NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"cae" text,
	"neto_gravado" numeric(14, 2) NOT NULL,
	"iva" numeric(14, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"fuente" text NOT NULL,
	"nombre_archivo" text,
	"storage_path" text,
	"pagado" boolean DEFAULT false NOT NULL,
	"fecha_pago" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "liquidos_producto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "liquido_producto_cobros" ADD CONSTRAINT "liquido_producto_cobros_liquido_producto_id_liquidos_producto_id_fk" FOREIGN KEY ("liquido_producto_id") REFERENCES "public"."liquidos_producto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquido_producto_cobros" ADD CONSTRAINT "liquido_producto_cobros_cobro_id_cobros_id_fk" FOREIGN KEY ("cobro_id") REFERENCES "public"."cobros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquido_producto_lineas" ADD CONSTRAINT "liquido_producto_lineas_liquido_producto_id_liquidos_producto_id_fk" FOREIGN KEY ("liquido_producto_id") REFERENCES "public"."liquidos_producto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquido_producto_lineas" ADD CONSTRAINT "liquido_producto_lineas_viaje_id_viajes_id_fk" FOREIGN KEY ("viaje_id") REFERENCES "public"."viajes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidos_producto" ADD CONSTRAINT "liquidos_producto_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "liquido_producto_cobros_lp_idx" ON "liquido_producto_cobros" USING btree ("liquido_producto_id");--> statement-breakpoint
CREATE INDEX "liquido_producto_cobros_cobro_idx" ON "liquido_producto_cobros" USING btree ("cobro_id");--> statement-breakpoint
CREATE INDEX "liquido_producto_lineas_lp_idx" ON "liquido_producto_lineas" USING btree ("liquido_producto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "liquido_producto_lineas_viaje_uq" ON "liquido_producto_lineas" USING btree ("viaje_id");--> statement-breakpoint
CREATE UNIQUE INDEX "liquidos_producto_cliente_numero_uq" ON "liquidos_producto" USING btree ("cliente_id","numero");--> statement-breakpoint
CREATE POLICY "liquido_producto_cobros_acceso_total_autenticados" ON "liquido_producto_cobros" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "liquido_producto_lineas_acceso_total_autenticados" ON "liquido_producto_lineas" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "liquidos_producto_acceso_total_autenticados" ON "liquidos_producto" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);