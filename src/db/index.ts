import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, {
  // DATABASE_URL apunta al Transaction pooler de Supabase (puerto 6543):
  // reutiliza conexiones entre transacciones distintas, así que no soporta
  // prepared statements de sesión. max: 1 porque en serverless cada
  // invocación puede ser una instancia nueva sin reuso garantizado del
  // cliente — sin esto se pueden acumular conexiones contra el límite del
  // pooler. idle_timeout libera las que quedan ociosas.
  prepare: false,
  max: 1,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
