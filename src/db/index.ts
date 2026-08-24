import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, {
  // DATABASE_URL apunta al pooler de Supabase (Session o Transaction mode,
  // puerto 5432/6543): no soporta prepared statements de sesión.
  //
  // El Session pooler del proyecto tiene pool_size: 15 conexiones en
  // total, compartidas entre TODAS las invocaciones serverless activas al
  // mismo tiempo. Con max: 5 alcanzaba con 3 invocaciones concurrentes
  // (uso real + Fluid Compute manteniendo instancias "warm") para volver
  // a pegar en el límite y tirar "max clients reached in session mode".
  // max: 2 deja margen para bastantes más invocaciones simultáneas antes
  // de acercarse al techo; el dashboard sigue corriendo sus ~12 queries
  // en paralelo, solo que de a 2 en vez de a 5 (más lento, no serializado
  // 1 a 1 como con max: 1, que sí llegó a disparar "statement timeout").
  // idle_timeout más corto libera las conexiones ociosas más rápido.
  prepare: false,
  max: 2,
  idle_timeout: 10,
});

export const db = drizzle(client, { schema });
