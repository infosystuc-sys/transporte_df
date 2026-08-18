import { cache } from "react";
import { and, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, configuracion, viajes } from "@/db/schema";

const HORAS_CTG_POR_DEFECTO = 24;
const DIAS_VENCIMIENTOS_POR_DEFECTO = 30;
const DIFERENCIA_TARIFA_PCT_POR_DEFECTO = 5;

// cache() de React deduplica por render: las alertas que la llaman (CTG,
// flota, choferes, diferencia de tarifa) se disparan juntas vía Promise.all
// en el dashboard, y sin esto cada una repetía la misma consulta a
// configuracion.
const obtenerUmbrales = cache(async () => {
  const [config] = await db.select().from(configuracion).limit(1);
  return {
    horasCtg: config?.alerta_ctg_horas ?? HORAS_CTG_POR_DEFECTO,
    diasVencimientos: config?.alerta_vencimientos_dias ?? DIAS_VENCIMIENTOS_POR_DEFECTO,
    diferenciaTarifaPct:
      config?.alerta_diferencia_tarifa_pct ?? String(DIFERENCIA_TARIFA_PCT_POR_DEFECTO),
  };
});

// Estados en los que la CPE/CTG todavía tiene que estar vigente para
// circular: una vez descargado, su vencimiento deja de ser un riesgo.
const ESTADOS_EN_RUTA = ["planificado", "cargado", "en_transito"] as const;

export type AlertaCtg = {
  viaje_id: number;
  numero: number;
  ctg: string | null;
  ctg_vencimiento: Date;
  cliente_nombre: string | null;
};

export async function alertasCtgPorVencer(): Promise<AlertaCtg[]> {
  const { horasCtg } = await obtenerUmbrales();
  const limite = new Date(Date.now() + horasCtg * 60 * 60 * 1000);

  return db
    .select({
      viaje_id: viajes.id,
      numero: viajes.numero,
      ctg: viajes.ctg,
      ctg_vencimiento: viajes.ctg_vencimiento,
      cliente_nombre: clientes.razon_social,
    })
    .from(viajes)
    .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
    .where(
      and(
        eq(viajes.tiene_cpe, true),
        isNotNull(viajes.ctg_vencimiento),
        lte(viajes.ctg_vencimiento, limite),
        inArray(viajes.estado, ESTADOS_EN_RUTA)
      )
    ) as Promise<AlertaCtg[]>;
}

export type AlertaVencimiento = {
  entidad_id: number;
  nombre: string;
  etiqueta: string;
  vencimiento: Date;
};

const CAMPOS_VENCIMIENTO_CAMION = [
  { campo: "vto_vtv", etiqueta: "VTV" },
  { campo: "vto_seguro", etiqueta: "Seguro" },
  { campo: "vto_ruta", etiqueta: "RUTA" },
  { campo: "vto_cnrt", etiqueta: "CNRT" },
  { campo: "vto_senasa", etiqueta: "SENASA" },
] as const;

export async function alertasVencimientosFlota(): Promise<AlertaVencimiento[]> {
  const { diasVencimientos } = await obtenerUmbrales();
  const limite = new Date(Date.now() + diasVencimientos * 24 * 60 * 60 * 1000);

  const filas = await db.select().from(camiones).where(eq(camiones.activo, true));

  const alertas: AlertaVencimiento[] = [];
  for (const camion of filas) {
    for (const { campo, etiqueta } of CAMPOS_VENCIMIENTO_CAMION) {
      const vencimiento = camion[campo];
      if (vencimiento && vencimiento <= limite) {
        alertas.push({ entidad_id: camion.id, nombre: camion.dominio_tractor, etiqueta, vencimiento });
      }
    }
  }
  return alertas.sort((a, b) => a.vencimiento.getTime() - b.vencimiento.getTime());
}

const CAMPOS_VENCIMIENTO_CHOFER = [
  { campo: "licencia_vto", etiqueta: "Licencia" },
  { campo: "linti_vto", etiqueta: "LINTI" },
] as const;

export async function alertasVencimientosChoferes(): Promise<AlertaVencimiento[]> {
  const { diasVencimientos } = await obtenerUmbrales();
  const limite = new Date(Date.now() + diasVencimientos * 24 * 60 * 60 * 1000);

  const filas = await db.select().from(choferes).where(eq(choferes.activo, true));

  const alertas: AlertaVencimiento[] = [];
  for (const chofer of filas) {
    for (const { campo, etiqueta } of CAMPOS_VENCIMIENTO_CHOFER) {
      const vencimiento = chofer[campo];
      if (vencimiento && vencimiento <= limite) {
        alertas.push({ entidad_id: chofer.id, nombre: chofer.nombre_completo, etiqueta, vencimiento });
      }
    }
  }
  return alertas.sort((a, b) => a.vencimiento.getTime() - b.vencimiento.getTime());
}

export type AlertaMerma = {
  viaje_id: number;
  numero: number;
  merma_pct: string | null;
  cliente_nombre: string | null;
};

export async function alertasMerma(): Promise<AlertaMerma[]> {
  return db
    .select({
      viaje_id: viajes.id,
      numero: viajes.numero,
      merma_pct: viajes.merma_pct,
      cliente_nombre: clientes.razon_social,
    })
    .from(viajes)
    .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
    .where(and(eq(viajes.merma_excede_tolerancia, true), eq(viajes.liquidado, false)));
}

export type AlertaCobroVencido = {
  viaje_id: number;
  numero: number;
  fecha_vto_cobro: Date;
  saldo_pendiente: string | null;
  cliente_nombre: string | null;
};

export async function alertasCobrosVencidos(): Promise<AlertaCobroVencido[]> {
  const ahora = new Date();
  return db
    .select({
      viaje_id: viajes.id,
      numero: viajes.numero,
      fecha_vto_cobro: viajes.fecha_vto_cobro,
      saldo_pendiente: viajes.saldo_pendiente,
      cliente_nombre: clientes.razon_social,
    })
    .from(viajes)
    .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
    .where(
      and(
        eq(viajes.facturado, true),
        isNotNull(viajes.fecha_vto_cobro),
        lte(viajes.fecha_vto_cobro, ahora),
        or(isNull(viajes.saldo_pendiente), gt(viajes.saldo_pendiente, "0"))
      )
    ) as Promise<AlertaCobroVencido[]>;
}

export type AlertaDiferenciaTarifa = {
  viaje_id: number;
  numero: number;
  valor_tarifa: string | null;
  valor_tarifa_declarada: string | null;
  diferencia_pct: string;
  cliente_nombre: string | null;
};

/**
 * Diferencia % entre lo que se cobra de verdad (valor_tarifa) y lo que
 * dice la documentación (valor_tarifa_declarada), relativa al valor
 * declarado. nullif evita dividir por cero si se cargó "0" como declarado.
 */
export async function alertasDiferenciaTarifa(): Promise<AlertaDiferenciaTarifa[]> {
  const { diferenciaTarifaPct } = await obtenerUmbrales();
  const diferenciaPct = sql<string>`abs(${viajes.valor_tarifa} - ${viajes.valor_tarifa_declarada}) / nullif(${viajes.valor_tarifa_declarada}, 0) * 100`;

  return db
    .select({
      viaje_id: viajes.id,
      numero: viajes.numero,
      valor_tarifa: viajes.valor_tarifa,
      valor_tarifa_declarada: viajes.valor_tarifa_declarada,
      diferencia_pct: diferenciaPct.as("diferencia_pct"),
      cliente_nombre: clientes.razon_social,
    })
    .from(viajes)
    .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
    .where(
      and(
        isNotNull(viajes.valor_tarifa),
        isNotNull(viajes.valor_tarifa_declarada),
        sql`${diferenciaPct} > ${diferenciaTarifaPct}`
      )
    ) as Promise<AlertaDiferenciaTarifa[]>;
}
