import type { Metadata } from "next";
import { obtenerCatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";
import { FormularioRevisionCpe } from "./_componentes/formulario-revision-cpe";

export const metadata: Metadata = {
  title: "Importar CPE — Gestión de Fletes",
};

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
          <a href="/viajes/importar-cpe-masivo" className="text-primary underline">
            Importar CPE (varios)
          </a>
          .
        </p>
      </div>
      <FormularioRevisionCpe {...catalogos} />
    </div>
  );
}
