import { and, eq, gt, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { viajes } from "@/db/schema";
import type { EstadoViaje } from "./estados";

export type BusquedaViajes = { [clave: string]: string | string[] | undefined };

function texto(sp: BusquedaViajes, clave: string) {
  const v = sp[clave];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

function numero(sp: BusquedaViajes, clave: string) {
  const s = texto(sp, clave);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
}

/** Arma el WHERE del listado de viajes a partir de los query params de la URL. */
export function condicionesFiltroViajes(sp: BusquedaViajes): SQL | undefined {
  const condiciones: SQL[] = [];

  const q = texto(sp, "q");
  if (q) {
    const like = `%${q}%`;
    const cond = or(
      ilike(viajes.ctg, like),
      ilike(viajes.cpe_nro, like),
      ilike(viajes.dominio_tractor, like),
      ilike(viajes.dominio_acoplado, like)
    );
    if (cond) condiciones.push(cond);
  }

  const fechaDesde = texto(sp, "fecha_desde");
  if (fechaDesde) condiciones.push(gte(viajes.fecha_carga, new Date(fechaDesde)));
  const fechaHasta = texto(sp, "fecha_hasta");
  if (fechaHasta) condiciones.push(lte(viajes.fecha_carga, new Date(fechaHasta)));

  const clienteId = numero(sp, "cliente_id");
  if (clienteId) condiciones.push(eq(viajes.cliente_id, clienteId));
  const choferId = numero(sp, "chofer_id");
  if (choferId) condiciones.push(eq(viajes.chofer_id, choferId));
  const camionId = numero(sp, "camion_id");
  if (camionId) condiciones.push(eq(viajes.camion_id, camionId));
  const productoId = numero(sp, "producto_id");
  if (productoId) condiciones.push(eq(viajes.producto_id, productoId));
  const origenId = numero(sp, "origen_id");
  if (origenId) condiciones.push(eq(viajes.origen_id, origenId));
  const destinoId = numero(sp, "destino_id");
  if (destinoId) condiciones.push(eq(viajes.destino_id, destinoId));

  const estado = texto(sp, "estado");
  if (estado) condiciones.push(eq(viajes.estado, estado as EstadoViaje));

  if (texto(sp, "merma") === "1") condiciones.push(eq(viajes.merma_excede_tolerancia, true));
  if (texto(sp, "pendiente_cobro") === "1") condiciones.push(gt(viajes.saldo_pendiente, "0"));
  if (texto(sp, "importado_de_excel") === "1") condiciones.push(eq(viajes.importado_de_excel, true));

  return condiciones.length ? and(...condiciones) : undefined;
}
