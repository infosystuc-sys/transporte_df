import type { Metadata } from "next";
import { ImportadorMasivoDescarga } from "./_componentes/importador-masivo-descarga";

export const metadata: Metadata = {
  title: "Importar descarga (varios) — Gestión de Fletes",
};

export default function ImportarDescargaMasivoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar descarga (varios)</h1>
        <p className="text-sm text-muted-foreground">
          Subí varios tickets de balanza o notas de recepción de una: la app va buscando el viaje de
          cada uno por CTG y te deja confirmar sin salir de esta pantalla.
        </p>
      </div>
      <ImportadorMasivoDescarga />
    </div>
  );
}
