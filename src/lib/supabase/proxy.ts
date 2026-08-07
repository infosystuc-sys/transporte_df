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
  // proyecto sin ida y vuelta a la red: es el chequeo "optimista"
  // recomendado por Supabase para usar en el proxy.
  const { data } = await supabase.auth.getClaims();
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
