import { z } from "zod";
import { textoOpcional, textoRequerido } from "./campos";

export const lugarSchema = z.object({
  nombre: textoRequerido(),
  tipo: z.enum(["campo", "planta", "acopio", "puerto", "otro"]).optional().nullable(),
  localidad: textoOpcional,
  provincia: textoOpcional,
  direccion: textoOpcional,
  n_planta: textoOpcional,
  renspa: textoOpcional,
  latitud: z.coerce.number().optional().nullable(),
  longitud: z.coerce.number().optional().nullable(),
  cliente_id: z.coerce.number().optional().nullable(),
  observaciones: textoOpcional,
  activo: z.boolean().default(true),
  // Una variante de escritura por línea (ej. "Mojon de Fierro"). Se
  // sincroniza contra lugares_alias reemplazando el set completo.
  alias: z.string().optional(),
});
export type LugarInput = z.input<typeof lugarSchema>;
