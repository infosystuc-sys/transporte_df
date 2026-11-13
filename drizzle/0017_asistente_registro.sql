CREATE TABLE "asistente_registro" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asistente_registro_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" uuid,
	"usuario_email" text,
	"tipo" text NOT NULL,
	"detalle" jsonb
);
--> statement-breakpoint
ALTER TABLE "asistente_registro" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "asistente_registro_usuario_creado_idx" ON "asistente_registro" USING btree ("usuario_id","creado_en");--> statement-breakpoint
CREATE POLICY "asistente_registro_acceso_total_autenticados" ON "asistente_registro" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);