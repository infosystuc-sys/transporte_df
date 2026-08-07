"use client";

import { useSyncExternalStore } from "react";

export type UnidadPeso = "tn" | "kg";

const CLAVE = "unidad_peso_preferida";

function suscribirse(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function obtenerSnapshot(): UnidadPeso {
  const v = window.localStorage.getItem(CLAVE);
  return v === "tn" || v === "kg" ? v : "tn";
}

function obtenerSnapshotServidor(): UnidadPeso {
  return "tn";
}

/** Recuerda la última unidad de peso elegida por el usuario (tn/kg). */
export function useUnidadPeso(): [UnidadPeso, (u: UnidadPeso) => void] {
  const unidad = useSyncExternalStore(suscribirse, obtenerSnapshot, obtenerSnapshotServidor);

  function cambiar(u: UnidadPeso) {
    window.localStorage.setItem(CLAVE, u);
    // El evento "storage" no se dispara en la misma pestaña que hizo el
    // cambio, así que lo forzamos para que useSyncExternalStore se entere.
    window.dispatchEvent(new Event("storage"));
  }

  return [unidad, cambiar];
}
