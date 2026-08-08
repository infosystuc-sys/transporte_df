import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El proxy ya protege esta ruta; este chequeo es la defensa "cerca de
  // los datos" que recomienda Next.js, no la única.
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
