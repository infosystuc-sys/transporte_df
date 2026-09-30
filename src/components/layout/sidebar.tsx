"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-full w-full bg-sidebar md:w-56 md:shrink-0">
      <div className="flex items-center justify-center border-b border-sidebar-border p-4">
        <Image src="/logo-don-felix.png" alt="Grupo Don Félix" width={112} height={112} />
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const activo = pathname === item.href;

          const Icono = item.icono;

          if (!item.disponible) {
            return (
              <span
                key={item.href}
                className="flex items-center justify-between gap-2.5 rounded-md px-3 py-2 text-sm font-bold text-sidebar-foreground/40"
              >
                <span className="flex items-center gap-2.5">
                  <Icono className="size-4 shrink-0" />
                  {item.label}
                </span>
                <span className="text-xs">Próximamente</span>
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-bold text-sidebar-foreground transition-colors hover:bg-white/5 hover:text-white",
                activo && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icono className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
