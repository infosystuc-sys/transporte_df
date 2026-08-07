import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  camiones,
  choferes,
  clientes,
  lugares,
  productos,
  tiposContingencia,
  viajeContingencias,
  viajes,
} from "@/db/schema";
import { formatoFechaInput } from "@/lib/schemas/campos-fecha";
import { StepperEstado } from "../_componentes/stepper-estado";
import { TabsViaje } from "./_componentes/tabs-viaje";
import { actualizarDatosGenerales } from "../actions";

const formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

function money(v: string | null) {
  return v ? formatoARS.format(Number(v)) : "—";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Viaje #${id} — Gestión de Fletes` };
}

export default async function ViajeDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const [viaje] = await db.select().from(viajes).where(eq(viajes.id, id));
  if (!viaje) notFound();

  const [
    filasClientes,
    filasCamiones,
    filasChoferes,
    filasProductos,
    filasLugares,
    filasContingencias,
    filasTiposContingencia,
  ] = await Promise.all([
    db
      .select({ id: clientes.id, nombre: clientes.razon_social })
      .from(clientes)
      .orderBy(asc(clientes.razon_social)),
    db
      .select({
        id: camiones.id,
        dominio_tractor: camiones.dominio_tractor,
        dominio_acoplado: camiones.dominio_acoplado,
      })
      .from(camiones)
      .orderBy(asc(camiones.dominio_tractor)),
    db
      .select({ id: choferes.id, nombre: choferes.nombre_completo })
      .from(choferes)
      .orderBy(asc(choferes.nombre_completo)),
    db.select({ id: productos.id, nombre: productos.nombre }).from(productos).orderBy(asc(productos.nombre)),
    db.select({ id: lugares.id, nombre: lugares.nombre }).from(lugares).orderBy(asc(lugares.nombre)),
    db.select().from(viajeContingencias).where(eq(viajeContingencias.viaje_id, id)),
    db.select({ id: tiposContingencia.id, nombre: tiposContingencia.nombre }).from(tiposContingencia),
  ]);

  const costos = viaje.importe_adicionales ? Number(viaje.importe_adicionales) : 0;
  const rentabilidad =
    viaje.total_a_cobrar != null ? Number(viaje.total_a_cobrar) - costos : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Viaje #{viaje.numero}</h1>
      </div>

      <StepperEstado viajeId={viaje.id} estadoActual={viaje.estado} facturaNroActual={viaje.factura_nro} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <TabsViaje
          datosGenerales={{
            valoresIniciales: {
              tiene_cpe: viaje.tiene_cpe,
              tipo_carga: viaje.tipo_carga,
              cpe_nro: viaje.cpe_nro ?? "",
              ctg: viaje.ctg ?? "",
              cpe_fecha_emision: formatoFechaInput(viaje.cpe_fecha_emision) as unknown as Date,
              ctg_vencimiento: formatoFechaInput(viaje.ctg_vencimiento) as unknown as Date,
              campania: viaje.campania ?? "",
              declaracion_calidad: viaje.declaracion_calidad ?? undefined,
              remito_nro: viaje.remito_nro ?? "",
              cliente_id: viaje.cliente_id,
              pagador_id: viaje.pagador_id ?? undefined,
              destinatario_id: viaje.destinatario_id ?? undefined,
              intermediario_id: viaje.intermediario_id ?? undefined,
              comision_intermediario_pct: viaje.comision_intermediario_pct ?? undefined,
              camion_id: viaje.camion_id ?? undefined,
              chofer_id: viaje.chofer_id ?? undefined,
              dominio_tractor: viaje.dominio_tractor ?? "",
              dominio_acoplado: viaje.dominio_acoplado ?? "",
              producto_id: viaje.producto_id ?? undefined,
              origen_id: viaje.origen_id ?? undefined,
              destino_id: viaje.destino_id ?? undefined,
              km: viaje.km ?? undefined,
              observaciones: viaje.observaciones ?? "",
            },
            clientes: filasClientes,
            camiones: filasCamiones,
            choferes: filasChoferes,
            productos: filasProductos,
            lugares: filasLugares,
            alGuardar: async (valores) => actualizarDatosGenerales(id, valores),
          }}
          carga={{
            viajeId: id,
            valoresIniciales: {
              fecha_carga: formatoFechaInput(viaje.fecha_carga) as unknown as Date,
              fecha_partida: formatoFechaInput(viaje.fecha_partida) as unknown as Date,
              bruto_origen: viaje.bruto_origen ?? undefined,
              tara_origen: viaje.tara_origen ?? undefined,
              neto_origen: viaje.neto_origen ?? undefined,
            },
          }}
          descarga={{
            viajeId: id,
            valoresIniciales: {
              fecha_arribo: formatoFechaInput(viaje.fecha_arribo) as unknown as Date,
              fecha_descarga: formatoFechaInput(viaje.fecha_descarga) as unknown as Date,
              n_turno_descarga: viaje.n_turno_descarga ?? "",
              bruto_destino: viaje.bruto_destino ?? undefined,
              tara_destino: viaje.tara_destino ?? undefined,
              neto_destino: viaje.neto_destino ?? undefined,
            },
          }}
          tarifa={{
            viajeId: id,
            valoresIniciales: {
              modalidad_tarifa: viaje.modalidad_tarifa ?? undefined,
              valor_tarifa: viaje.valor_tarifa ?? undefined,
              base_calculo: viaje.base_calculo ?? undefined,
            },
          }}
          contingencias={{
            viajeId: id,
            filas: filasContingencias,
            tiposContingencia: filasTiposContingencia,
          }}
        />

        <aside className="flex h-fit flex-col gap-3 rounded-md border p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Resumen</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total a cobrar</span>
              <span>{money(viaje.total_a_cobrar)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costos</span>
              <span>{money(viaje.importe_adicionales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rentabilidad estimada</span>
              <span>{rentabilidad != null ? formatoARS.format(rentabilidad) : "—"}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            El cálculo completo de importes y rentabilidad se termina de armar en las Fases 7 y 8.
          </p>
        </aside>
      </div>
    </div>
  );
}
