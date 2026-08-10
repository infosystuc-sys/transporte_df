ALTER TABLE "viajes" DROP CONSTRAINT "viajes_pagador_id_clientes_id_fk";
--> statement-breakpoint
DROP INDEX "viajes_pagador_id_idx";--> statement-breakpoint
ALTER TABLE "viajes" DROP COLUMN "pagador_id";