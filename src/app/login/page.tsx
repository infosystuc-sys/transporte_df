import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Ingresar — Gestión de Fletes",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col items-center gap-3">
          <Image
            src="/logo-don-felix.png"
            alt="Grupo Don Félix"
            width={120}
            height={120}
            priority
          />
          <CardTitle className="text-xl">Gestión de Fletes</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
