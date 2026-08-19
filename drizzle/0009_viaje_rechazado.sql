ALTER TYPE "public"."estado_viaje" ADD VALUE 'rechazado';--> statement-breakpoint
ALTER TABLE "viajes" ADD COLUMN "viaje_reemplaza_a_id" bigint;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_viaje_reemplaza_a_id_viajes_id_fk" FOREIGN KEY ("viaje_reemplaza_a_id") REFERENCES "public"."viajes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "viajes_reemplaza_a_id_idx" ON "viajes" USING btree ("viaje_reemplaza_a_id");