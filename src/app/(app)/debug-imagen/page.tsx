"use client";

import { useState } from "react";

type Resultado = {
  ok: boolean;
  archivoOriginal?: { nombre: string; tipo: string; tamañoKB: number; primerosBytesHex: string };
  imagenFinal?: { ancho: number; alto: number; tamañoKB: number };
  textoEmbebido?: { largo: number; muestra: string; cpe_nro: string | null; titular_cuit: string | null };
  claude?: { tieneApiKey: boolean; resultado: unknown; error: string | null };
  dataUrl?: string;
  error?: unknown;
};

/**
 * Página de diagnóstico temporal: sube un archivo real y muestra
 * exactamente la imagen (y sus medidas) tal cual le llegaría a Claude,
 * para ver si la pérdida de calidad reportada pasa en nuestro
 * procesamiento o en otro lado. Se borra apenas se confirme la causa.
 */
export default function DebugImagenPage() {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setCargando(true);
    setResultado(null);
    try {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const res = await fetch("/api/debug-imagen", { method: "POST", body: formData });
      const json = await res.json();
      setResultado(json);
    } catch (err) {
      setResultado({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-bold">Diagnóstico de imagen (temporal)</h1>
      <p className="text-sm text-muted-foreground">
        Elegí el mismo archivo que intentaste subir. Se procesa igual que en Importar CPE y se
        muestra la imagen final tal cual le llega a Claude.
      </p>
      <input type="file" accept="application/pdf,image/*,.heic,.heif" onChange={onSeleccionar} />
      {cargando && <p>Procesando...</p>}
      {resultado && (
        <pre className="overflow-auto rounded-md border bg-muted p-3 text-xs">
          {JSON.stringify(
            {
              ok: resultado.ok,
              archivoOriginal: resultado.archivoOriginal,
              imagenFinal: resultado.imagenFinal,
              textoEmbebido: resultado.textoEmbebido,
              claude: resultado.claude,
              error: resultado.error,
            },
            null,
            2
          )}
        </pre>
      )}
      {resultado?.dataUrl && (
        <img src={resultado.dataUrl} alt="Imagen final" className="max-w-full border" />
      )}
    </div>
  );
}
