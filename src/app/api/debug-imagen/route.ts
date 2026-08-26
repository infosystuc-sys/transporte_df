import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canvasParaClaude, LADO_LARGO_MAX_IA, renderizarPrimeraPagina } from "@/lib/cpe/render";
import { extraerConClaude } from "@/lib/cpe/claude";
import { extraerTextoCpe } from "@/lib/cpe/extraer";
import { parseTextoCpe } from "@/lib/cpe/parser";

// Endpoint de diagnóstico temporal: procesa un archivo real con el mismo
// pipeline que usa la importación de CPE (renderizarPrimeraPagina +
// canvasParaClaude) y devuelve la imagen final tal cual le llegaría a
// Claude, más sus medidas -- para ver si la pérdida de calidad reportada
// pasa en nuestro procesamiento o en otro lado. Se borra apenas se
// confirme la causa.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const archivo = formData.get("archivo");
    if (!(archivo instanceof File)) {
      return NextResponse.json({ ok: false, error: "Falta el archivo." }, { status: 400 });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const canvas = await renderizarPrimeraPagina(buffer, 2.5, LADO_LARGO_MAX_IA);
    const imagen = canvasParaClaude(canvas);
    const jpegBytes = Buffer.from(imagen.data, "base64");

    // Mismo primer paso que procesarCpe: si el texto embebido alcanza,
    // Claude ni se llama -- esto muestra por qué, en vez de dejarlo
    // adivinar a partir del mensaje genérico de la pantalla real.
    const texto = await extraerTextoCpe(buffer);
    const porTexto = parseTextoCpe(texto);

    let porClaude = null;
    let errorClaude: string | null = null;
    try {
      porClaude = await extraerConClaude(buffer);
    } catch (err) {
      errorClaude = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }

    return NextResponse.json({
      ok: true,
      archivoOriginal: {
        nombre: archivo.name,
        tipo: archivo.type,
        tamañoKB: Math.round(buffer.length / 1024),
        primerosBytesHex: buffer.subarray(0, 12).toString("hex"),
      },
      imagenFinal: {
        ancho: canvas.width,
        alto: canvas.height,
        tamañoKB: Math.round(jpegBytes.length / 1024),
      },
      textoEmbebido: {
        largo: texto.length,
        muestra: texto.slice(0, 300),
        cpe_nro: porTexto.cpe_nro,
        titular_cuit: porTexto.titular_cuit,
      },
      claude: {
        tieneApiKey: !!process.env.ANTHROPIC_API_KEY,
        resultado: porClaude,
        error: errorClaude,
      },
      dataUrl: `data:image/jpeg;base64,${imagen.data}`,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });
  }
}
