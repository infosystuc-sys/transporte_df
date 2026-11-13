import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ejecutarAccion } from "@/lib/asistente/acciones";
import { ACCIONES_POR_ROL, rolDeUsuario } from "@/lib/asistente/permisos";
import { registrar } from "@/lib/asistente/registro";

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

  const usuario = { id: user.id, email: user.email ?? "usuario sin email" };
  const tipo = (accion as { tipo?: unknown } | null)?.tipo;
  // El rol se controla acá también: no alcanza con que Félix no lo proponga.
  const rol = await rolDeUsuario(user.id);
  if (typeof tipo !== "string" || !ACCIONES_POR_ROL[rol].includes(tipo)) {
    await registrar(usuario, "error", { accion, error: "acción no permitida para el rol", rol });
    return NextResponse.json({ error: "No tenés permiso para hacer eso desde Félix." }, { status: 403 });
  }

  try {
    const r = await ejecutarAccion(accion, archivo instanceof File && archivo.size > 0 ? archivo : null, usuario.email);
    await registrar(usuario, r.ok ? "confirmada" : "error", { accion, ...(r.ok ? { mensaje: r.mensaje } : { error: r.error }) });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    return NextResponse.json({ mensaje: r.mensaje });
  } catch (err) {
    console.error("Félix: falló ejecutar la acción:", err);
    await registrar(usuario, "error", { accion, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo o cargalo desde la pantalla." }, { status: 500 });
  }
}
