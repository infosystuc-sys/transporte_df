"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 bg-sidebar md:block">
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const activo = pathname === item.href;

          if (!item.disponible) {
            return (
              <span
                key={item.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/40"
              >
                {item.label}
                <span className="text-xs">Próximamente</span>
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-white/5 hover:text-white",
                activo && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
