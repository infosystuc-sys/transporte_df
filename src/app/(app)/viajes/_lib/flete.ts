import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, configuracion, viajeAdicionales, viajes } from "@/db/schema";

type BaseCalculo = "origen" | "destino";

/**
 * Recalcula importe_flete, importe_adicionales (los a cargo del cliente),
 * importe_comision y total_a_cobrar (spec 4.5-4.6). Se corre después de
 * guardar Tarifa, Carga, Descarga, Datos generales (cliente/intermediario/
 * comisión) o al tocar los adicionales del viaje: cualquiera de esos
 * cambios puede alterar el resultado.
 */
export async function recalcularFlete(viajeId: number) {
  const [viaje] = await db.select().from(viajes).where(eq(viajes.id, viajeId));
  if (!viaje) return;

  // Base de cálculo: la que ya tiene el viaje (elegida a mano o resuelta
  // antes); si nunca se resolvió, cliente > configuración global > destino.
  let baseCalculo: BaseCalculo | null = viaje.base_calculo;
  if (!baseCalculo) {
    const [cliente] = viaje.cliente_id
      ? await db.select().from(clientes).where(eq(clientes.id, viaje.cliente_id))
      : [];
    if (cliente?.base_calculo_flete && cliente.base_calculo_flete !== "heredar") {
      baseCalculo = cliente.base_calculo_flete;
    } else {
      const [config] = await db.select().from(configuracion).limit(1);
      baseCalculo = config?.base_calculo_flete_default ?? "destino";
    }
  }

  // Neto de la base elegida; si no está cargado, se usa el otro (spec 4.5).
  const netoOrigen = viaje.neto_origen != null ? Number(viaje.neto_origen) : null;
  const netoDestino = viaje.neto_destino != null ? Number(viaje.neto_destino) : null;
  const netoBaseKg =
    baseCalculo === "origen" ? (netoOrigen ?? netoDestino) : (netoDestino ?? netoOrigen);

  const valorTarifa = viaje.valor_tarifa != null ? Number(viaje.valor_tarifa) : null;
  let importeFlete: number | null = null;
  if (valorTarifa != null) {
    switch (viaje.modalidad_tarifa) {
      case "por_tonelada":
        importeFlete = netoBaseKg != null ? valorTarifa * (netoBaseKg / 1000) : null;
        break;
      case "por_km":
        importeFlete = viaje.km != null ? valorTarifa * viaje.km : null;
        break;
      case "por_tonelada_km":
        importeFlete =
          netoBaseKg != null && viaje.km != null
            ? valorTarifa * (netoBaseKg / 1000) * viaje.km
            : null;
        break;
      case "monto_fijo":
        importeFlete = valorTarifa;
        break;
      default:
        importeFlete = null;
    }
  }

  const filasAdicionales = await db
    .select()
    .from(viajeAdicionales)
    .where(eq(viajeAdicionales.viaje_id, viajeId));
  const adicionalesCliente = filasAdicionales
    .filter((a) => a.a_cargo_de === "cliente")
    .reduce((suma, a) => suma + Number(a.importe), 0);

  let importeComision = 0;
  if (viaje.intermediario_id && viaje.comision_intermediario_pct != null && importeFlete != null) {
    importeComision = importeFlete * (Number(viaje.comision_intermediario_pct) / 100);
  }

  const totalACobrar = importeFlete != null ? importeFlete + adicionalesCliente - importeComision : null;

  await db
    .update(viajes)
    .set({
      base_calculo: baseCalculo,
      importe_flete: importeFlete != null ? importeFlete.toFixed(2) : null,
      importe_adicionales: adicionalesCliente.toFixed(2),
      importe_comision: importeComision.toFixed(2),
      total_a_cobrar: totalACobrar != null ? totalACobrar.toFixed(2) : null,
    })
    .where(eq(viajes.id, viajeId));
}

/** Suma de los adicionales a cargo de la empresa (costo, no cobro). */
export async function totalAdicionalesEmpresa(viajeId: number) {
  const filas = await db
    .select()
    .from(viajeAdicionales)
    .where(eq(viajeAdicionales.viaje_id, viajeId));
  return filas
    .filter((a) => a.a_cargo_de === "empresa")
    .reduce((suma, a) => suma + Number(a.importe), 0);
}
