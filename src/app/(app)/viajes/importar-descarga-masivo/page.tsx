import type { Metadata } from "next";
import { ImportadorMasivoDescarga } from "./_componentes/importador-masivo-descarga";

export const metadata: Metadata = {
  title: "Importar descarga (varios) — Gestión de Fletes",
};

// Ver la nota en viajes/importar-cpe/page.tsx: mismo límite de Server
// Action, misma razón (acá, la lectura por Claude del ticket/nota).
export const maxDuration = 60;

export default function ImportarDescargaMasivoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-black tracking-[-0.01em]">Importar descarga (varios)</h1>
        <p className="text-sm text-muted-foreground">
          Subí varios tickets de balanza o notas de recepción de una: la app va buscando el viaje de
          cada uno por CTG y te deja confirmar sin salir de esta pantalla.
        </p>
      </div>
      <ImportadorMasivoDescarga />
    </div>
  );
}
