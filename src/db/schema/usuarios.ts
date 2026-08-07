import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { accesoTotalAutenticados, timestampTz } from "./_helpers";

/**
 * Extiende auth.users de Supabase. Login simple (email + password), sin
 * roles ni permisos todavía: rol queda preparado para el futuro, todos los
 * usuarios logueados ven y editan todo.
 */
export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    rol: text("rol").notNull().default("admin"),
    creado_en: timestampTz("creado_en").notNull().defaultNow(),
  },
  () => [accesoTotalAutenticados("usuarios")]
).enableRLS();
