/**
 * Confirma contra la base, columna por columna / valor de enum por valor
 * de enum, que cada migración de esta lista quedó realmente aplicada —
 * en vez de confiar en el mensaje de éxito de drizzle-kit/drizzle-orm.
 * Pensado para verificar después de un pnpm db:migrate (o
 * db:migrate:verbose) en un entorno donde no se puede confirmar de otra
 * forma que cada migración específica se aplicó.
 *
 * Uso: node scripts/verify-migrations.mjs (o `pnpm db:verify`). Agregá un
 * chequeo nuevo a CHEQUEOS cada vez que generes una migración.
 */
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";

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

const sql = postgres(url, { max: 1 });

const CHEQUEOS = [
  {
    migracion: "0006_modalidad_gasoil_surtidor_propio",
    ok: async () => {
      const filas = await sql`select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'modalidad_gasoil' and e.enumlabel = 'surtidor_propio'`;
      return filas.length > 0;
    },
  },
  {
    migracion: "0007_valor_tarifa_declarada",
    ok: async () => {
      const filas = await sql`select 1 from information_schema.columns where table_name = 'viajes' and column_name = 'valor_tarifa_declarada'`;
      return filas.length > 0;
    },
  },
  {
    migracion: "0008_alerta_diferencia_tarifa",
    ok: async () => {
      const filas = await sql`select 1 from information_schema.columns where table_name = 'configuracion' and column_name = 'alerta_diferencia_tarifa_pct'`;
      return filas.length > 0;
    },
  },
  {
    migracion: "0009_viaje_rechazado",
    ok: async () => {
      const [enumOk, colOk] = await Promise.all([
        sql`select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'estado_viaje' and e.enumlabel = 'rechazado'`,
        sql`select 1 from information_schema.columns where table_name = 'viajes' and column_name = 'viaje_reemplaza_a_id'`,
      ]);
      return enumOk.length > 0 && colOk.length > 0;
    },
  },
  {
    migracion: "0010_humedad_pct",
    ok: async () => {
      const filas = await sql`select 1 from information_schema.columns where table_name = 'viajes' and column_name = 'humedad_pct'`;
      return filas.length > 0;
    },
  },
];

console.log("Verificando las 5 migraciones directamente contra la base...\n");

let todasOk = true;
for (const chequeo of CHEQUEOS) {
  try {
    const aplicada = await chequeo.ok();
    console.log(`${aplicada ? "✅" : "❌"} ${chequeo.migracion}`);
    if (!aplicada) todasOk = false;
  } catch (err) {
    console.log(`❌ ${chequeo.migracion} — error al verificar: ${err.message}`);
    todasOk = false;
  }
}

console.log(todasOk ? "\nOK: las 5 migraciones están aplicadas." : "\nFALTAN migraciones — ver ❌ arriba.");
await sql.end();
process.exitCode = todasOk ? 0 : 1;
