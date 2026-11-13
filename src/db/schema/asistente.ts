import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { accesoTotalAutenticados, idPk, timestampTz } from "./_helpers";

/**
 * Registro de lo que pasa con Félix: cada pregunta, cada propuesta que
 * arma y cada acción que se confirma (quién, cuándo y con qué datos).
 * Sirve para rastrear una carga ("¿esto lo cargó Félix? ¿quién lo
 * confirmó?") y para el límite de mensajes por hora.
 */
export const asistenteRegistro = pgTable(
  "asistente_registro",
  {
    id: idPk(),
    creado_en: timestampTz("creado_en").notNull().defaultNow(),
    usuario_id: uuid("usuario_id"),
    usuario_email: text("usuario_email"),
    // pregunta | propuesta | confirmada | error
    tipo: text("tipo").notNull(),
    detalle: jsonb("detalle"),
  },
  (t) => [
    accesoTotalAutenticados("asistente_registro"),
    index("asistente_registro_usuario_creado_idx").on(t.usuario_id, t.creado_en),
  ]
).enableRLS();
