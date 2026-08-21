import { z } from "zod";
import { decimalOpcional, decimalRequerido, textoOpcional } from "./campos";
import { fechaRequerida } from "./campos-fecha";

const idOpcional = z.coerce.number().optional().nullable();

export const cargaGasoilSchema = z
  .object({
    fecha: fechaRequerida(),
    camion_id: z.coerce.number({ error: "Elegí un camión." }),
    chofer_id: idOpcional,
    viaje_id: idOpcional,
    estacion_id: idOpcional,
    litros: decimalRequerido(),
    precio_litro: decimalOpcional(),
    // A veces el proveedor factura recién en la liquidación, no al momento
    // de cargar combustible — importe y odómetro pueden completarse
    // después (salvo que el chofer ya lo haya pagado él mismo, ver abajo).
    importe: decimalOpcional(),
    // preprocess: el input de texto manda "" cuando se deja vacío, y
    // z.coerce.number() lo convertiría en 0 en vez de tratarlo como
    // ausente.
    odometro: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().int().optional().nullable()
    ),
    modalidad: z.enum(["cuenta_corriente", "pagado_por_chofer", "surtidor_propio"], {
      error: "Elegí la modalidad de pago.",
    }),
    rendido: z.boolean().default(false),
    comprobante_nro: textoOpcional,
    observaciones: textoOpcional,
  })
  .refine((v) => v.modalidad !== "pagado_por_chofer" || v.importe != null, {
    error: "Ingresá el importe para poder reintegrárselo al chofer.",
    path: ["importe"],
  });
export type CargaGasoilInput = z.input<typeof cargaGasoilSchema>;
