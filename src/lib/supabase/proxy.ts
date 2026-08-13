import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_PUBLICAS = ["/login"];

const TIMEOUT_AUTH_MS = 5000;

/**
 * fetch con abort real a los TIMEOUT_AUTH_MS: un Promise.race contra un
 * setTimeout deja de esperar la promesa perdedora, pero no cancela el
 * fetch de fondo — en el runtime de Edge de Vercel eso alcanzó a colgar
 * igual la respuesta hasta el límite real de la función (300s), porque
 * la invocación no se considera terminada mientras esa conexión siga
 * abierta. Acortar la conexión con AbortController sí la corta de verdad.
 */
const fetchConTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_AUTH_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
};

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
      global: { fetch: fetchConTimeout },
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
  // Supabase hace fetch a /.well-known/jwks.json — en una instancia
  // serverless fría (cache vacío) eso puede colgar el proxy y tumbar
  // TODAS las rutas, login incluido. fetchConTimeout aborta esa conexión
  // sola a los 5s; acá solo hace falta no dejar que el error de abort
  // rompa la respuesta — se cae a "no autenticado" (redirige a /login).
  let estaAutenticado = false;
  try {
    const { data } = await supabase.auth.getClaims();
    estaAutenticado = data?.claims != null;
  } catch {
    estaAutenticado = false;
  }

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
