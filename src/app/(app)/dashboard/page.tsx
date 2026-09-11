import type { Metadata } from "next";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { movimientosChofer, viajes } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  alertasCobrosVencidos,
  alertasCtgPorVencer,
  alertasDiferenciaTarifa,
  alertasMerma,
  alertasVencimientosChoferes,
  alertasVencimientosFlota,
} from "@/lib/alertas";
import { GraficoViajesPorEstado, GraficoViajesPorMes } from "./_componentes/graficos-dashboard";
import { TarjetaAlertas } from "./_componentes/tarjeta-alertas";

export const metadata: Metadata = {
  title: "Dashboard — Gestión de Fletes",
};

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba" });

export default async function DashboardPage() {
  const [
    porEstado,
    porMes,
    filaPendienteCobro,
    filaSaldoChoferes,
    ctg,
    vencFlota,
    vencChoferes,
    merma,
    cobrosVencidos,
    diferenciaTarifa,
  ] = await Promise.all([
    db
      .select({ estado: viajes.estado, cantidad: sql<number>`count(*)::int` })
      .from(viajes)
      .groupBy(viajes.estado),
    db
      .select({
        mes: sql<string>`to_char(date_trunc('month', ${viajes.creado_en} at time zone 'America/Argentina/Cordoba'), 'YYYY-MM')`,
        cantidad: sql<number>`count(*)::int`,
      })
      .from(viajes)
      .where(sql`${viajes.creado_en} >= date_trunc('month', now()) - interval '5 months'`)
      .groupBy(
        sql`to_char(date_trunc('month', ${viajes.creado_en} at time zone 'America/Argentina/Cordoba'), 'YYYY-MM')`
      )
      .orderBy(
        sql`to_char(date_trunc('month', ${viajes.creado_en} at time zone 'America/Argentina/Cordoba'), 'YYYY-MM')`
      ),
    db
      .select({ total: sql<string>`coalesce(sum(${viajes.saldo_pendiente}), 0)` })
      .from(viajes)
      .where(
        and(eq(viajes.facturado, true), or(isNull(viajes.saldo_pendiente), gt(viajes.saldo_pendiente, "0")))
      ),
    db
      .select({
        total: sql<string>`coalesce(sum(case when ${movimientosChofer.tipo} in ('liquidacion','gasto_rendido') then ${movimientosChofer.importe} else -${movimientosChofer.importe} end), 0)`,
      })
      .from(movimientosChofer)
      .where(isNull(movimientosChofer.liquidacion_id)),
    alertasCtgPorVencer(),
    alertasVencimientosFlota(),
    alertasVencimientosChoferes(),
    alertasMerma(),
    alertasCobrosVencidos(),
    alertasDiferenciaTarifa(),
  ]);

  const totalPendienteCobro = Number(filaPendienteCobro[0]?.total ?? 0);
  const saldoPendienteChoferes = Number(filaSaldoChoferes[0]?.total ?? 0);
  const totalViajes = porEstado.reduce((s, f) => s + f.cantidad, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Viajes totales</CardTitle>
          </CardHeader>
          <CardContent className="text-[20px] font-extrabold">{totalViajes}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendiente de cobro</CardTitle>
          </CardHeader>
          <CardContent className="text-[20px] font-extrabold">{formatoARS.format(totalPendienteCobro)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo pendiente a choferes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[20px] font-extrabold">
            {formatoARS.format(saldoPendienteChoferes)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Alertas activas</CardTitle>
          </CardHeader>
          <CardContent className="text-[20px] font-extrabold">
            {ctg.length +
              vencFlota.length +
              vencChoferes.length +
              merma.length +
              cobrosVencidos.length +
              diferenciaTarifa.length}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GraficoViajesPorEstado datos={porEstado} />
        <GraficoViajesPorMes datos={porMes} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TarjetaAlertas
          titulo="CTG por vencer"
          vacio="Sin CTG por vencer en viajes en ruta."
          items={ctg.map((a) => ({
            href: `/viajes/${a.viaje_id}`,
            texto: `#${a.numero} — ${a.cliente_nombre ?? "—"}`,
            detalle: formatoFecha.format(a.ctg_vencimiento),
          }))}
        />
        <TarjetaAlertas
          titulo="Cobros vencidos"
          vacio="Sin cobros vencidos."
          items={cobrosVencidos.map((a) => ({
            href: `/viajes/${a.viaje_id}`,
            texto: `#${a.numero} — ${a.cliente_nombre ?? "—"}`,
            detalle: a.saldo_pendiente ? formatoARS.format(Number(a.saldo_pendiente)) : "—",
          }))}
        />
        <TarjetaAlertas
          titulo="Vencimientos de flota"
          vacio="Sin vencimientos próximos en la flota."
          items={vencFlota.map((a) => ({
            href: "/camiones",
            texto: `${a.nombre} — ${a.etiqueta}`,
            detalle: formatoFecha.format(a.vencimiento),
          }))}
        />
        <TarjetaAlertas
          titulo="Vencimientos de choferes"
          vacio="Sin vencimientos próximos de choferes."
          items={vencChoferes.map((a) => ({
            href: "/choferes",
            texto: `${a.nombre} — ${a.etiqueta}`,
            detalle: formatoFecha.format(a.vencimiento),
          }))}
        />
        <TarjetaAlertas
          titulo="Merma fuera de tolerancia"
          vacio="Sin viajes con merma fuera de tolerancia."
          items={merma.map((a) => ({
            href: `/viajes/${a.viaje_id}`,
            texto: `#${a.numero} — ${a.cliente_nombre ?? "—"}`,
            detalle: a.merma_pct ? `${Number(a.merma_pct).toFixed(2)}%` : "—",
          }))}
        />
        <TarjetaAlertas
          titulo="Tarifa real vs. declarada"
          vacio="Sin diferencias entre tarifa real y declarada."
          items={diferenciaTarifa.map((a) => ({
            href: `/viajes/${a.viaje_id}`,
            texto: `#${a.numero} — ${a.cliente_nombre ?? "—"}`,
            detalle: `${Number(a.diferencia_pct).toFixed(2)}%`,
          }))}
        />
      </div>
    </div>
  );
}
