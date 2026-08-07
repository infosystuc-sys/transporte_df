import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { camiones, choferes, clientes, lugares, productos } from "@/db/schema";
import { FormularioDatosGenerales } from "../_componentes/formulario-datos-generales";
import { crearViaje } from "../actions";
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
  pagador_id: undefined,
  destinatario_id: undefined,
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

export default async function NuevoViajePage() {
  const [filasClientes, filasCamiones, filasChoferes, filasProductos, filasLugares] =
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
    ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Nuevo viaje</h1>
      <FormularioDatosGenerales
        valoresIniciales={valoresPorDefecto}
        clientes={filasClientes}
        camiones={filasCamiones}
        choferes={filasChoferes}
        productos={filasProductos}
        lugares={filasLugares}
        alGuardar={crearViaje}
        textoBoton="Crear viaje"
      />
    </div>
  );
}
