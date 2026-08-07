import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ error: "Ingresá un email válido." }),
  password: z.string().min(1, { error: "Ingresá tu contraseña." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
