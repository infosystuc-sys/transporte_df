import type { Metadata } from "next";
import { ImportadorLp } from "./_componentes/importador-lp";

export const metadata: Metadata = {
  title: "Importar líquido producto — Gestión de Fletes",
};

// Ver la nota en viajes/importar-cpe/page.tsx: la lectura por IA (si el
// LP no trae texto) puede pasar el límite por defecto de una Server Action.
export const maxDuration = 60;

export default function ImportarLpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-black tracking-[-0.01em]">Importar líquido producto</h1>
        <p className="text-sm text-muted-foreground">
          Subí los líquidos producto que te mandan los clientes: el sistema busca cada viaje por su
          CTG, te muestra en qué difiere lo liquidado de lo que tenés cargado (kilos de destino,
          tarifa, flete y comisión) y, al confirmar, los deja facturados con ese comprobante.
        </p>
      </div>
      <ImportadorLp />
    </div>
  );
}
