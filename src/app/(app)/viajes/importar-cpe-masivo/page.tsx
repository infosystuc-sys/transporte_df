import type { Metadata } from "next";
import { obtenerCatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";
import { ImportadorMasivoCpe } from "./_componentes/importador-masivo-cpe";

export const metadata: Metadata = {
  title: "Importar CPE (varios) — Gestión de Fletes",
};

export default async function ImportarCpeMasivoPage() {
  const catalogos = await obtenerCatalogosImportacionCpe();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar CPE (varios)</h1>
        <p className="text-sm text-muted-foreground">
          Subí varios PDF o fotos de una: la app los va leyendo uno por uno y te deja confirmar
          cada viaje sin salir de esta pantalla.
        </p>
      </div>
      <ImportadorMasivoCpe {...catalogos} />
    </div>
  );
}
