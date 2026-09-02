"use client";

import type { OpcionGasoil } from "@/lib/gasoil/datos-catalogos";

export function ImportadorMasivoGasoil({
  camiones,
  choferes,
  estaciones,
  viajes,
}: {
  camiones: OpcionGasoil[];
  choferes: OpcionGasoil[];
  estaciones: OpcionGasoil[];
  viajes: OpcionGasoil[];
}) {
  void camiones;
  void choferes;
  void estaciones;
  void viajes;
  return <p className="text-sm text-muted-foreground">Próximamente.</p>;
}
