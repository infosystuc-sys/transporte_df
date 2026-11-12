import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ejecutarAccion } from "@/lib/asistente/acciones";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Guarda una acción que preparó Félix y el usuario confirmó con el botón.
 * Multipart: "accion" (JSON {tipo, datos}) y, si corresponde, "archivo"
 * (la foto del comprobante que se adjunta). ejecutarAccion valida todo de
 * nuevo, así que no importa de dónde venga la propuesta.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión para confirmar." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const crudo = form?.get("accion");
  const archivo = form?.get("archivo");
  let accion: unknown = null;
  try {
    accion = typeof crudo === "string" ? JSON.parse(crudo) : null;
  } catch {
    // queda null: ejecutarAccion lo rechaza
  }

  try {
    const r = await ejecutarAccion(accion, archivo instanceof File && archivo.size > 0 ? archivo : null, user.email ?? "usuario");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    return NextResponse.json({ mensaje: r.mensaje });
  } catch (err) {
    console.error("Félix: falló ejecutar la acción:", err);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo o cargalo desde la pantalla." }, { status: 500 });
  }
}
