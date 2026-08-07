import { z } from "zod";
import { decimalRequerido, textoOpcional } from "./campos";
import { fechaRequerida } from "./campos-fecha";

const idOpcional = z.coerce.number().optional().nullable();

export const movimientoManualSchema = z.object({
  fecha: fechaRequerida(),
  tipo: z.enum(["adelanto", "devolucion", "ajuste"], { error: "Elegí un tipo." }),
  importe: decimalRequerido(),
  medio_pago_id: idOpcional,
  descripcion: textoOpcional,
});
export type MovimientoManualInput = z.input<typeof movimientoManualSchema>;
