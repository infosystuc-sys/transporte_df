"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

export function MenuMobile() {
  const [abierto, setAbierto] = useState(false);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="data-[side=left]:w-64 p-0">
        <SheetTitle className="sr-only">Navegación</SheetTitle>
        <div onClick={() => setAbierto(false)} className="flex-1">
          <Sidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
}
