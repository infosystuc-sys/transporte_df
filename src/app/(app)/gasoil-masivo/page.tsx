import type { Metadata } from "next";
import { obtenerCatalogosGasoil } from "@/lib/gasoil/datos-catalogos";
import { ImportadorMasivoGasoil } from "./_componentes/importador-masivo-gasoil";

export const metadata: Metadata = {
  title: "Gasoil en tanda — Gestión de Fletes",
};

export default async function GasoilMasivoPage() {
  const catalogos = await obtenerCatalogosGasoil();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Gasoil en tanda</h1>
        <p className="text-sm text-muted-foreground">
          Subí varios comprobantes de carga de combustible de una: la app va buscando el camión de
          cada uno por patente y te deja confirmar sin salir de esta pantalla.
        </p>
      </div>
      <ImportadorMasivoGasoil
        camiones={catalogos.camiones}
        choferes={catalogos.choferes}
        estaciones={catalogos.estaciones}
        viajes={catalogos.viajes}
      />
    </div>
  );
}
