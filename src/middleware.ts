import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/proxy";

// Next.js 16 renombró middleware.ts -> proxy.ts (funcionalmente idéntico,
// según la propia documentación de Next.js). Se volvió a este nombre
// porque en Vercel, con proxy.ts, ninguna ruta respondía (404 NOT_FOUND
// en el borde, sin invocar ninguna función, en todos los alias del
// deployment): la tooling de build/deploy de Vercel no reconoce todavía
// la convención nueva. middleware.ts es la convención estable que Vercel
// sí soporta hace años.
export function middleware(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
