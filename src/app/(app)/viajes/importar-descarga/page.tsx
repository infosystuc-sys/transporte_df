import type { Metadata } from "next";
import Link from "next/link";
import { FormularioImportarDescarga } from "./_componentes/formulario-importar-descarga";

export const metadata: Metadata = {
  title: "Importar descarga — Gestión de Fletes",
};

export default function ImportarDescargaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Importar descarga</h1>
        <p className="text-sm text-muted-foreground">
          Subí el ticket de balanza o la nota de recepción del destino: el sistema lee el CTG,
          busca el viaje que ya tenés cargado con ese CTG, y precarga los datos de descarga para
          que los revises antes de confirmar.
        </p>
        <p className="text-sm text-muted-foreground">
          ¿Tenés varios archivos para cargar de una?{" "}
          <Link href="/viajes/importar-descarga-masivo" className="text-primary underline">
            Importar descarga (varios)
          </Link>
          .
        </p>
      </div>
      <FormularioImportarDescarga />
    </div>
  );
}
