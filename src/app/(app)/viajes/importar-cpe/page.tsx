import type { Metadata } from "next";
import Link from "next/link";
import { obtenerCatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";
import { FormularioRevisionCpe } from "./_componentes/formulario-revision-cpe";

export const metadata: Metadata = {
  title: "Importar CPE — Gestión de Fletes",
};

// El fallback de Claude (claude-opus-5, para CPE escaneadas o fotos, que
// invoca la Server Action importarCpe definida en ./actions) puede tardar
// más que el límite por defecto de una Server Action en Vercel (10s en
// Hobby) -- sin esto la función se corta a mitad de camino y el cliente
// ve un genérico "An unexpected response was received from the server"
// en vez del resultado o de un error prolijo. 60s es el máximo permitido
// en Hobby. Va acá (la página que invoca la acción) y no en actions.ts
// porque un archivo "use server" solo puede exportar funciones async --
// cualquier otra exportación (como esta) hace que Next descarte todas las
// demás exportaciones del módulo en producción.
export const maxDuration = 60;

export default async function ImportarCpePage() {
  const catalogos = await obtenerCatalogosImportacionCpe();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar CPE</h1>
        <p className="text-sm text-muted-foreground">
          Subí el PDF o una foto de la Carta de Porte Electrónica: el sistema intenta completar los
          datos del viaje automáticamente, pero siempre revisás y confirmás antes de guardar nada.
        </p>
        <p className="text-sm text-muted-foreground">
          ¿Tenés varios archivos para cargar de una?{" "}
          <Link href="/viajes/importar-cpe-masivo" className="text-primary underline">
            Importar CPE (varios)
          </Link>
          .
        </p>
      </div>
      <FormularioRevisionCpe {...catalogos} />
    </div>
  );
}
