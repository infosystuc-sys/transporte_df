"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Cuántas pantallas de la app se recorrieron en esta pestaña. Vive a nivel
// módulo: sobrevive a las navegaciones del lado del cliente y se reinicia
// al recargar, que es justo cuando router.back() podría sacarte de la app.
let pantallasVisitadas = 0;

/** "/viajes/123" → "/viajes"; "/cobranzas/cobros/nuevo" → "/cobranzas/cobros". */
function pantallaPadre(ruta: string) {
  const partes = ruta.split("/").filter(Boolean);
  return partes.length > 1 ? `/${partes.slice(0, -1).join("/")}` : "/dashboard";
}

/**
 * Flecha para volver a la pantalla anterior. Solo aparece dentro de una
 * sección (un viaje, un cliente, una carga): en las pantallas del menú
 * lateral no hace falta. Si se entró directo (link, recarga), en vez de
 * salir de la app lleva a la pantalla de arriba.
 */
export function BotonVolver() {
  const ruta = usePathname();
  const router = useRouter();

  useEffect(() => {
    pantallasVisitadas += 1;
  }, [ruta]);

  if (ruta.split("/").filter(Boolean).length < 2) return null;

  function volver() {
    if (pantallasVisitadas > 1) router.back();
    else router.push(pantallaPadre(ruta));
  }

  return (
    <Button variant="ghost" size="sm" onClick={volver} className="-ml-2 mb-3 w-fit gap-1.5 text-muted-foreground">
      <ArrowLeft className="size-4" />
      Volver
    </Button>
  );
}
