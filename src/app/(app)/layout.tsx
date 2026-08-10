import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

// Todo lo que cuelga de este layout depende de la sesión y hace consultas
// reales a Supabase por request: nunca debe intentar generarse como
// estático. Sin esto, next build igual prueba renderizarlas una vez para
// decidir si son estáticas, y esas consultas reales durante el build
// (a veces varias en paralelo, como en el dashboard) pueden tardar más
// de 60s y tirar abajo el build entero.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El middleware ya protege esta ruta; este chequeo es la defensa "cerca
  // de los datos" que recomienda Next.js, no la única.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
        <span className="text-[16.5px] font-extrabold tracking-[-0.01em]">Gestión de Fletes</span>
        <UserMenu email={user.email ?? ""} />
      </header>
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
