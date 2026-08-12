import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_PUBLICAS = ["/login"];

/**
 * Refresca la sesión de Supabase en cada request y protege las rutas que
 * no están en RUTAS_PUBLICAS. Se usa desde proxy.ts (raíz de src/).
 */
export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims valida la firma del JWT contra las claves públicas del
  // proyecto. Solo evita la ida y vuelta a la red cuando el JWKS ya está
  // en cache (memoria del proceso) y no venció: si no, el propio SDK de
  // Supabase hace fetch a /.well-known/jwks.json sin timeout — en una
  // instancia serverless fría (cache vacío) eso puede colgar el proxy
  // hasta el límite de la función (300s) y tumbar TODAS las rutas, login
  // incluido. Con el timeout acá, ante un problema de red se cae a "no
  // autenticado" (redirige a /login) en vez de colgar la respuesta.
  const data = await Promise.race([
    supabase.auth.getClaims().then((r) => r.data),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);
  const estaAutenticado = data?.claims != null;

  const { pathname } = request.nextUrl;
  const esRutaPublica = RUTAS_PUBLICAS.includes(pathname);

  if (!estaAutenticado && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (estaAutenticado && esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
