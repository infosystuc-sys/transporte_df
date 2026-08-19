import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, lugares, productos, viajes } from "@/db/schema";
import { FormularioDatosGenerales } from "../_componentes/formulario-datos-generales";
import { crearViaje, crearViajeReemplazo } from "../actions";
import type { ViajeDatosGeneralesInput } from "@/lib/schemas/viajes";

export const metadata: Metadata = {
  title: "Nuevo viaje — Gestión de Fletes",
};

const valoresPorDefecto: ViajeDatosGeneralesInput = {
  tiene_cpe: true,
  tipo_carga: "grano",
  cpe_nro: "",
  ctg: "",
  cpe_fecha_emision: undefined,
  ctg_vencimiento: undefined,
  campania: "",
  declaracion_calidad: undefined,
  remito_nro: "",
  cliente_id: undefined as unknown as number,
  titular_nombre: "",
  titular_cuit: "",
  destinatario_nombre: "",
  destinatario_cuit: "",
  intermediario_id: undefined,
  comision_intermediario_pct: undefined,
  camion_id: undefined,
  chofer_id: undefined,
  dominio_tractor: "",
  dominio_acoplado: "",
  producto_id: undefined,
  origen_id: undefined,
  destino_id: undefined,
  km: undefined,
  observaciones: "",
};

export default async function NuevoViajePage({
  searchParams,
}: {
  searchParams: Promise<{ reemplaza?: string }>;
}) {
  const { reemplaza } = await searchParams;
  const reemplazaAId = reemplaza ? Number(reemplaza) : null;

  const [filasClientes, filasCamiones, filasChoferes, filasProductos, filasLugares, filaOriginal] =
    await Promise.all([
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
      db
        .select({ id: productos.id, nombre: productos.nombre })
        .from(productos)
        .orderBy(asc(productos.nombre)),
      db.select({ id: lugares.id, nombre: lugares.nombre }).from(lugares).orderBy(asc(lugares.nombre)),
      reemplazaAId != null && !Number.isNaN(reemplazaAId)
        ? db
            .select({
              numero: viajes.numero,
              cliente_id: viajes.cliente_id,
              camion_id: viajes.camion_id,
              chofer_id: viajes.chofer_id,
              producto_id: viajes.producto_id,
            })
            .from(viajes)
            .where(eq(viajes.id, reemplazaAId))
        : Promise.resolve([]),
    ]);
  const original = filaOriginal[0] ?? null;

  const valores: ViajeDatosGeneralesInput = original
    ? {
        ...valoresPorDefecto,
        cliente_id: original.cliente_id,
        camion_id: original.camion_id ?? undefined,
        chofer_id: original.chofer_id ?? undefined,
        producto_id: original.producto_id ?? undefined,
      }
    : valoresPorDefecto;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[25px] font-extrabold tracking-[-0.01em]">
          {original ? `Viaje de reemplazo del #${original.numero}` : "Nuevo viaje"}
        </h1>
        <Link href="/viajes/importar-cpe" className="text-sm text-primary hover:underline">
          ¿Tenés el PDF de la CPE? Importalo automáticamente
        </Link>
      </div>
      <FormularioDatosGenerales
        valoresIniciales={valores}
        clientes={filasClientes}
        camiones={filasCamiones}
        choferes={filasChoferes}
        productos={filasProductos}
        lugares={filasLugares}
        alGuardar={original ? crearViajeReemplazo.bind(null, reemplazaAId!) : crearViaje}
        textoBoton="Crear viaje"
      />
    </div>
  );
}
