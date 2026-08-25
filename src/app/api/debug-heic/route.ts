import { NextResponse } from "next/server";

// Endpoint de diagnóstico temporal: aísla si el import de heic-convert
// (que carga libheif-js, un binario WASM) rompe en el serverless de
// Vercel, sin pasar por la Server Action ni por Claude -- para ver el
// error real en vez del digest genérico que Next.js devuelve en
// producción. Se borra apenas se confirme la causa.
export async function GET() {
  const pasos: Record<string, string> = {};
  try {
    pasos.import_heic_convert = "intentando...";
    const mod = await import("heic-convert");
    pasos.import_heic_convert = "OK, tipo=" + typeof mod.default;

    pasos.import_render = "intentando...";
    const { renderizarPrimeraPagina } = await import("@/lib/cpe/render");
    pasos.import_render = "OK, tipo=" + typeof renderizarPrimeraPagina;

    return NextResponse.json({ ok: true, pasos });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      pasos,
      error: err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : String(err),
    });
  }
}
