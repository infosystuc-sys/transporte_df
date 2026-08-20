/**
 * `pnpm db:migrate` (drizzle-kit migrate) traga el error real cuando falla
 * en algunas terminales de Windows: el spinner de progreso lo pisa con
 * códigos ANSI de "borrar línea" antes de que el proceso termine, así que
 * solo queda "ELIFECYCLE Command failed with exit code 1" sin ninguna
 * pista de la causa (confirmado reproduciendo el bug con una conexión
 * inválida a propósito). Este script hace lo mismo que drizzle-kit migrate
 * pero llamando a la función de drizzle-orm directo, sin spinner, así que
 * un error de conexión/auth/lo que sea se ve completo.
 *
 * Uso: node scripts/migrate-verbose.mjs (o `pnpm db:migrate:verbose`).
 */
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Carga .env.local a mano (sin depender de dotenv-cli ni de que el
// comando se invoque con el wrapper correcto) — así este script siempre
// funciona con solo `node scripts/migrate-verbose.mjs`.
if (existsSync(".env.local")) {
  for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const igual = limpia.indexOf("=");
    if (igual === -1) continue;
    const clave = limpia.slice(0, igual).trim();
    const valor = limpia.slice(igual + 1).trim();
    if (clave && !(clave in process.env)) process.env[clave] = valor;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("No hay DATABASE_URL en el entorno (revisá .env.local).");
  process.exit(1);
}

console.log("Conectando...");
const client = postgres(url, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("OK: migraciones aplicadas sin error.");
} catch (err) {
  console.error("FALLÓ. Error completo:");
  console.error(err);
  if (err?.cause) {
    console.error("Cause:");
    console.error(err.cause);
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
