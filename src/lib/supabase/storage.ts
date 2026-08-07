import { createClient } from "@supabase/supabase-js";

export const BUCKET_ADJUNTOS = "adjuntos";

/**
 * Cliente con service role: bypassa RLS de Storage. Se usa solo desde
 * Server Actions / Route Handlers, nunca se expone al navegador — los
 * adjuntos son privados y se acceden vía URL firmada.
 */
function clienteStorage() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function subirAdjunto(ruta: string, archivo: Buffer, contentType: string) {
  const { error } = await clienteStorage()
    .storage.from(BUCKET_ADJUNTOS)
    .upload(ruta, archivo, { contentType, upsert: false });
  if (error) throw error;
}

export async function urlFirmadaAdjunto(ruta: string, segundos = 3600): Promise<string> {
  const { data, error } = await clienteStorage()
    .storage.from(BUCKET_ADJUNTOS)
    .createSignedUrl(ruta, segundos);
  if (error) throw error;
  return data.signedUrl;
}

export async function eliminarAdjunto(ruta: string) {
  const { error } = await clienteStorage().storage.from(BUCKET_ADJUNTOS).remove([ruta]);
  if (error) throw error;
}
