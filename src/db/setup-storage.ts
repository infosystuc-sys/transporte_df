import { createClient } from "@supabase/supabase-js";
import { BUCKET_ADJUNTOS } from "@/lib/supabase/storage";

/**
 * Crea el bucket privado de Storage para adjuntos si todavía no existe.
 * Idempotente: se puede correr de nuevo sin romper nada (ej. si se recrea
 * el proyecto de Supabase). No usa Drizzle porque storage.buckets es un
 * esquema administrado por Supabase, no parte del modelo de datos propio.
 */
async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: buckets, error: errorListado } = await supabase.storage.listBuckets();
  if (errorListado) throw errorListado;

  if (buckets.some((b) => b.name === BUCKET_ADJUNTOS)) {
    console.log(`El bucket "${BUCKET_ADJUNTOS}" ya existe.`);
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET_ADJUNTOS, {
    public: false,
    fileSizeLimit: "20MB",
  });
  if (error) throw error;
  console.log(`Bucket "${BUCKET_ADJUNTOS}" creado (privado).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
