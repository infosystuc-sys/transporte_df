"use client";

import { useSearchParams } from "next/navigation";

/** Arma un href a /viajes con los query params actuales + un patch. */
export function useQueryString() {
  const searchParams = useSearchParams();
  return (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(patch)) {
      if (valor === undefined) params.delete(clave);
      else params.set(clave, valor);
    }
    const qs = params.toString();
    return qs ? `/viajes?${qs}` : "/viajes";
  };
}
