import { z } from "zod";
import { decimalOpcional, decimalRequerido, textoOpcional } from "./campos";
import { fechaRequerida } from "./campos-fecha";

const idOpcional = z.coerce.number().optional().nullable();

export const cargaGasoilSchema = z.object({
  fecha: fechaRequerida(),
  camion_id: z.coerce.number({ error: "Elegí un camión." }),
  chofer_id: idOpcional,
  viaje_id: idOpcional,
  estacion_id: idOpcional,
  litros: decimalRequerido(),
  precio_litro: decimalOpcional(),
  importe: decimalRequerido(),
  odometro: z.coerce.number({ error: "Ingresá el odómetro." }).int(),
  modalidad: z.enum(["cuenta_corriente", "pagado_por_chofer", "surtidor_propio"], {
    error: "Elegí la modalidad de pago.",
  }),
  rendido: z.boolean().default(false),
  comprobante_nro: textoOpcional,
  observaciones: textoOpcional,
});
export type CargaGasoilInput = z.input<typeof cargaGasoilSchema>;
