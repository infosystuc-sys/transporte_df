import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, {
  // DATABASE_URL apunta al Transaction pooler de Supabase (puerto 6543):
  // reutiliza conexiones entre transacciones distintas, así que no soporta
  // prepared statements de sesión.
  //
  // max: 10 (no 1) — el dashboard ("/") dispara ~12 queries con
  // Promise.all esperando que corran en paralelo. Con max: 1 se
  // serializaban todas sobre una sola conexión, y esa cola alcanzó a
  // hacer que Postgres cancelara alguna por "statement timeout". El
  // pooler multiplexa conexiones de verdad hacia Postgres, así que tener
  // varias por invocación es seguro; cada invocación serverless sigue
  // siendo de corta vida. idle_timeout libera las que quedan ociosas.
  prepare: false,
  max: 10,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
