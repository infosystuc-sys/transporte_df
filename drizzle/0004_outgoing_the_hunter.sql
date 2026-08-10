ALTER TABLE "viajes" DROP CONSTRAINT "viajes_destinatario_id_clientes_id_fk";
--> statement-breakpoint
DROP INDEX "viajes_destinatario_id_idx";--> statement-breakpoint
ALTER TABLE "viajes" DROP COLUMN "destinatario_id";