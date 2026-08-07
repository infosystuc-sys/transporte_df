import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { camiones, choferes, clientes, lugares, productos, viajes } from "@/db/schema";
import { db } from "@/db";

export const origenLugar = alias(lugares, "origen_lugar");
export const destinoLugar = alias(lugares, "destino_lugar");

/** Select con los joins que necesita el listado/export de viajes. */
export function consultaViajes() {
  return db
    .select({
      id: viajes.id,
      numero: viajes.numero,
      estado: viajes.estado,
      ctg: viajes.ctg,
      cpe_nro: viajes.cpe_nro,
      fecha_carga: viajes.fecha_carga,
      dominio_tractor: viajes.dominio_tractor,
      neto_destino: viajes.neto_destino,
      valor_tarifa: viajes.valor_tarifa,
      merma_excede_tolerancia: viajes.merma_excede_tolerancia,
      cliente_nombre: clientes.razon_social,
      chofer_nombre: choferes.nombre_completo,
      producto_nombre: productos.nombre,
      origen_nombre: origenLugar.nombre,
      destino_nombre: destinoLugar.nombre,
    })
    .from(viajes)
    .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
    .leftJoin(choferes, eq(viajes.chofer_id, choferes.id))
    .leftJoin(camiones, eq(viajes.camion_id, camiones.id))
    .leftJoin(productos, eq(viajes.producto_id, productos.id))
    .leftJoin(origenLugar, eq(viajes.origen_id, origenLugar.id))
    .leftJoin(destinoLugar, eq(viajes.destino_id, destinoLugar.id));
}
