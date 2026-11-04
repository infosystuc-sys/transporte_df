import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, inArray, notExists } from "drizzle-orm";
import { db } from "@/db";
import {
  choferes,
  clientes,
  cobroImputaciones,
  liquidoProductoLineas,
  liquidosProducto,
  mediosPago,
  viajes,
} from "@/db/schema";
import { Button } from "@/components/ui/button";
import { diferenciasLp } from "@/lib/lp/comparar";
import { PanelCobranzas, type ClienteCobranza, type LpCobranza } from "./_componentes/panel-cobranzas";

export const metadata: Metadata = {
  title: "Cobranzas — Gestión de Fletes",
};

const REALIZADOS = ["descargado", "facturado", "cobrado", "liquidado"] as const;
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function CobranzasPage({ searchParams }: { searchParams: Promise<{ lp?: string }> }) {
  const sp = await searchParams;

  const [cabeceras, lineas, sinLp, medios] = await Promise.all([
    db
      .select({
        id: liquidosProducto.id,
        cliente_id: liquidosProducto.cliente_id,
        cliente: clientes.razon_social,
        cuit: clientes.cuit,
        numero: liquidosProducto.numero,
        fecha: liquidosProducto.fecha,
        neto: liquidosProducto.neto_gravado,
        iva: liquidosProducto.iva,
        total: liquidosProducto.total,
        fuente: liquidosProducto.fuente,
        tiene_pdf: liquidosProducto.storage_path,
        pagado: liquidosProducto.pagado,
        fecha_pago: liquidosProducto.fecha_pago,
      })
      .from(liquidosProducto)
      .innerJoin(clientes, eq(liquidosProducto.cliente_id, clientes.id))
      .orderBy(desc(liquidosProducto.fecha), desc(liquidosProducto.id)),
    db
      .select({
        linea: liquidoProductoLineas,
        viaje_numero: viajes.numero,
        chofer: choferes.nombre_completo,
        fecha_descarga: viajes.fecha_descarga,
        neto_destino: viajes.neto_destino,
        valor_tarifa: viajes.valor_tarifa,
        importe_flete: viajes.importe_flete,
        comision_intermediario_pct: viajes.comision_intermediario_pct,
        saldo_pendiente: viajes.saldo_pendiente,
      })
      .from(liquidoProductoLineas)
      .leftJoin(viajes, eq(liquidoProductoLineas.viaje_id, viajes.id))
      .leftJoin(choferes, eq(viajes.chofer_id, choferes.id))
      .orderBy(asc(liquidoProductoLineas.id)),
    // Viajes hechos que todavía no tienen LP ni cobros: lo que falta que el cliente liquide.
    db
      .select({
        id: viajes.id,
        numero: viajes.numero,
        cliente_id: viajes.cliente_id,
        cliente: clientes.razon_social,
        cuit: clientes.cuit,
        ctg: viajes.ctg,
        fecha_descarga: viajes.fecha_descarga,
        chofer: choferes.nombre_completo,
        total_a_cobrar: viajes.total_a_cobrar,
        factura_nro: viajes.factura_nro,
      })
      .from(viajes)
      .leftJoin(clientes, eq(viajes.cliente_id, clientes.id))
      .leftJoin(choferes, eq(viajes.chofer_id, choferes.id))
      .where(
        and(
          inArray(viajes.estado, [...REALIZADOS]),
          notExists(
            db.select({ uno: liquidoProductoLineas.id }).from(liquidoProductoLineas).where(eq(liquidoProductoLineas.viaje_id, viajes.id))
          ),
          notExists(db.select({ uno: cobroImputaciones.id }).from(cobroImputaciones).where(eq(cobroImputaciones.viaje_id, viajes.id)))
        )
      )
      .orderBy(asc(viajes.fecha_descarga)),
    db.select({ id: mediosPago.id, nombre: mediosPago.nombre }).from(mediosPago).orderBy(asc(mediosPago.id)),
  ]);

  const lineasPorLp = new Map<number, LpCobranza["lineas"]>();
  for (const f of lineas) {
    const l = f.linea;
    const lineaLp = {
      ctg: l.ctg,
      kg: l.kg != null ? Number(l.kg) : null,
      tarifa: l.tarifa != null ? Number(l.tarifa) : null,
      km: l.km,
      total: Number(l.flete),
      comision: Number(l.comision),
      otros_descuentos: Number(l.otros_descuentos),
    };
    const pct = lineaLp.total > 0 && lineaLp.comision > 0 ? (lineaLp.comision / lineaLp.total) * 100 : null;
    const diferencias =
      l.viaje_id != null
        ? diferenciasLp(lineaLp, pct, {
            neto_destino: f.neto_destino,
            valor_tarifa: f.valor_tarifa,
            importe_flete: f.importe_flete,
            comision_intermediario_pct: f.comision_intermediario_pct,
          }).map((d) => `${d.campo}: LP ${d.lp} · viaje ${d.app}`)
        : [];
    const lista = lineasPorLp.get(l.liquido_producto_id) ?? [];
    lista.push({
      id: l.id,
      ctg: l.ctg,
      viaje_id: l.viaje_id,
      viaje_numero: f.viaje_numero,
      chofer: f.chofer,
      fecha_descarga: iso(f.fecha_descarga),
      kg: lineaLp.kg,
      tarifa: lineaLp.tarifa,
      flete: lineaLp.total,
      comision: lineaLp.comision,
      otros_descuentos: lineaLp.otros_descuentos,
      neto: Number(l.neto),
      total: Number(l.total),
      saldo: f.saldo_pendiente != null ? Number(f.saldo_pendiente) : null,
      aviso: l.aviso,
      diferencias,
    });
    lineasPorLp.set(l.liquido_producto_id, lista);
  }

  const porCliente = new Map<number, ClienteCobranza>();
  const cliente = (id: number, nombre: string, cuit: string | null) => {
    let c = porCliente.get(id);
    if (!c) {
      c = { id, nombre, cuit, lps: [], sin_lp: [] };
      porCliente.set(id, c);
    }
    return c;
  };
  for (const lp of cabeceras) {
    cliente(lp.cliente_id, lp.cliente, lp.cuit).lps.push({
      id: lp.id,
      numero: lp.numero,
      fecha: iso(lp.fecha)!,
      neto: Number(lp.neto),
      iva: Number(lp.iva),
      total: Number(lp.total),
      leido_con_ia: lp.fuente === "ia",
      tiene_pdf: !!lp.tiene_pdf,
      pagado: lp.pagado,
      fecha_pago: iso(lp.fecha_pago),
      lineas: lineasPorLp.get(lp.id) ?? [],
    });
  }
  for (const v of sinLp) {
    if (v.cliente_id == null) continue;
    cliente(v.cliente_id, v.cliente ?? "Sin cliente", v.cuit).sin_lp.push({
      id: v.id,
      numero: v.numero,
      ctg: v.ctg,
      fecha_descarga: iso(v.fecha_descarga),
      chofer: v.chofer,
      total_a_cobrar: v.total_a_cobrar != null ? Number(v.total_a_cobrar) : null,
      factura_nro: v.factura_nro,
    });
  }
  const clientesOrdenados = [...porCliente.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-black tracking-[-0.01em]">Cobranzas</h1>
          <p className="text-sm text-muted-foreground">
            Los líquidos producto de cada cliente, con sus viajes. Marcá cada LP como pagado cuando entra la plata.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/cobranzas/cobros">Cobros registrados</Link>
          </Button>
          <Button asChild>
            <Link href="/cobranzas/cargar-lp">Cargar líquidos producto</Link>
          </Button>
        </div>
      </div>
      <PanelCobranzas
        clientes={clientesOrdenados}
        medios={medios}
        lpDestacado={sp.lp ? Number(sp.lp) : null}
      />
    </div>
  );
}
