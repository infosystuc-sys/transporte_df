"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

export async function login(values: LoginInput) {
  const validado = loginSchema.safeParse(values);

  if (!validado.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(validado.data);

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  redirect("/");
}
