import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, configuracion, viajeAdicionales, viajes } from "@/db/schema";
import { resolverCascadaTarifa, type BaseCalculo, type ModalidadTarifa } from "@/lib/tarifa-defaults";

/**
 * Trae lo que necesita resolverCascadaTarifa desde la DB. Separada de la
 * cascada en sí (que es pura, en @/lib/tarifa-defaults) para poder
 * reusar esa lógica también del lado del cliente, en la precarga de la
 * pantalla de revisión de Importar CPE antes de crear el viaje.
 */
export async function resolverDefaultsTarifa(clienteId: number | null | undefined) {
  const [cliente] = clienteId
    ? await db.select().from(clientes).where(eq(clientes.id, clienteId))
    : [];
  const [config] = await db.select().from(configuracion).limit(1);

  return resolverCascadaTarifa(cliente?.base_calculo_flete, {
    base_calculo_flete_default: config?.base_calculo_flete_default,
    modalidad_tarifa_default: config?.modalidad_tarifa_default,
  });
}

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

  // base_calculo y modalidad_tarifa: los que ya tiene el viaje (elegidos
  // a mano o resueltos antes); si alguno nunca se resolvió, se completa
  // con la cascada de defaults. Sin esto, un viaje al que nunca se le
  // eligió modalidad_tarifa a mano se queda con importe_flete en null
  // para siempre, aunque valor_tarifa esté cargado -- modalidad_tarifa
  // nunca tenía ningún mecanismo de default, a diferencia de base_calculo.
  let baseCalculo: BaseCalculo | null = viaje.base_calculo;
  let modalidadTarifa: ModalidadTarifa | null = viaje.modalidad_tarifa;
  if (!baseCalculo || !modalidadTarifa) {
    const defaults = await resolverDefaultsTarifa(viaje.cliente_id);
    baseCalculo ??= defaults.baseCalculo;
    modalidadTarifa ??= defaults.modalidadTarifa;
  }

  // Neto de la base elegida; si no está cargado, se usa el otro (spec 4.5).
  const netoOrigen = viaje.neto_origen != null ? Number(viaje.neto_origen) : null;
  const netoDestino = viaje.neto_destino != null ? Number(viaje.neto_destino) : null;
  const netoBaseKg =
    baseCalculo === "origen" ? (netoOrigen ?? netoDestino) : (netoDestino ?? netoOrigen);

  const valorTarifa = viaje.valor_tarifa != null ? Number(viaje.valor_tarifa) : null;
  let importeFlete: number | null = null;
  if (valorTarifa != null) {
    switch (modalidadTarifa) {
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
      modalidad_tarifa: modalidadTarifa,
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
