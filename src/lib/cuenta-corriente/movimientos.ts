import { db } from "@/db";
import { movimientosChofer } from "@/db/schema";

/**
 * Crea un movimiento generado por el sistema (no a mano) a partir de un
 * gasto rendido por el chofer o una carga de gasoil pagada por él. Solo se
 * llama desde Server Actions.
 */
export async function registrarMovimientoAutomatico(datos: {
  chofer_id: number;
  tipo: "gasto_rendido";
  importe: string;
  viaje_id?: number | null;
  descripcion: string;
}) {
  await db.insert(movimientosChofer).values({
    fecha: new Date(),
    chofer_id: datos.chofer_id,
    tipo: datos.tipo,
    importe: datos.importe,
    viaje_id: datos.viaje_id ?? undefined,
    origen_automatico: true,
    descripcion: datos.descripcion,
  });
}
