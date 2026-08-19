import { db } from "./index";
import {
  condicionesPago,
  configuracion,
  mediosPago,
  productos,
  tiposAdicional,
  tiposContingencia,
  tiposGasto,
} from "./schema";

async function seedCatalogos() {
  await db
    .insert(condicionesPago)
    .values([
      { nombre: "Contado", dias: 0 },
      { nombre: "Contra descarga", dias: 0 },
      { nombre: "7 días", dias: 7 },
      { nombre: "15 días", dias: 15 },
      { nombre: "30 días", dias: 30 },
      { nombre: "60 días", dias: 60 },
    ])
    .onConflictDoNothing();

  await db
    .insert(mediosPago)
    .values([
      { nombre: "Efectivo" },
      { nombre: "Transferencia" },
      { nombre: "Cheque", requiere_datos_cheque: true },
      { nombre: "eCheq", requiere_datos_cheque: true },
      { nombre: "Gasoil" },
      { nombre: "Compensación" },
      { nombre: "Otro" },
    ])
    .onConflictDoNothing();

  await db
    .insert(tiposAdicional)
    .values([
      { nombre: "Estadía/Espera", a_cargo_default: "cliente" },
      { nombre: "Descarga", a_cargo_default: "cliente" },
      { nombre: "Peaje", a_cargo_default: "empresa" },
      { nombre: "Camino de tierra", a_cargo_default: "cliente" },
      { nombre: "Retorno vacío", a_cargo_default: "cliente" },
      { nombre: "Contraflete", a_cargo_default: "cliente" },
      { nombre: "Otro", a_cargo_default: "empresa" },
    ])
    .onConflictDoNothing();

  await db
    .insert(tiposContingencia)
    .values([
      { nombre: "Rechazo en destino / Reacondicionamiento" },
      { nombre: "Rotura/Avería" },
      { nombre: "Demora" },
    ])
    .onConflictDoNothing();

  await db
    .insert(tiposGasto)
    .values([
      { nombre: "Peaje" },
      { nombre: "Balanza" },
      { nombre: "Lavado" },
      { nombre: "Reparación en ruta" },
      { nombre: "Viático" },
      { nombre: "Guía" },
      { nombre: "Otro" },
    ])
    .onConflictDoNothing();

  await db
    .insert(productos)
    .values([
      { nombre: "Maíz", tipo: "grano" },
      { nombre: "Soja", tipo: "grano" },
      { nombre: "Trigo", tipo: "grano" },
      { nombre: "Arroz", tipo: "grano" },
      { nombre: "Fertilizante a granel", tipo: "fertilizante" },
    ])
    .onConflictDoNothing();

  const filaConfiguracion = await db.select().from(configuracion).limit(1);
  if (filaConfiguracion.length === 0) {
    await db.insert(configuracion).values({
      razon_social: "Sanchez Rafael Edmundo",
      cuit: "20230271020",
    });
  }
}

seedCatalogos()
  .then(() => {
    console.log("Catálogos sembrados.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
