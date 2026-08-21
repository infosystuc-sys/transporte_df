import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, {
  // DATABASE_URL apunta al pooler de Supabase (Session o Transaction mode,
  // puerto 5432/6543): no soporta prepared statements de sesión.
  //
  // max: 5 (ni 1 ni 10) — el dashboard ("/") dispara ~12 queries con
  // Promise.all esperando que corran en paralelo. Con max: 1 se
  // serializaban todas sobre una sola conexión, y esa cola alcanzó a
  // hacer que Postgres cancelara alguna por "statement timeout". Pero en
  // Session pooler el pool_size del proyecto está limitado a 15
  // conexiones en total: con max: 10, dos invocaciones concurrentes ya
  // superaban ese límite y todo empezaba a fallar con "max clients
  // reached in session mode" (o, en Transaction pooler, se quedaba
  // colgado esperando un slot libre hasta el timeout de Vercel). max: 5
  // deja margen para varias invocaciones simultáneas sin acercarse al
  // límite. idle_timeout libera las que quedan ociosas.
  prepare: false,
  max: 5,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
