import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { accesoTotalAutenticados, cantidad, dinero, fkBigint, idPk, timestampTz } from "./_helpers";
import { modalidadGasoilEnum } from "./enums";
import { camiones, choferes } from "./flota";
import { viajes } from "./viajes";
import { estacionesServicio } from "./catalogos";

export const cargasGasoil = pgTable(
  "cargas_gasoil",
  {
    id: idPk(),
    fecha: timestampTz("fecha").notNull(),
    camion_id: fkBigint("camion_id")
      .notNull()
      .references(() => camiones.id, { onDelete: "restrict" }),
    chofer_id: fkBigint("chofer_id").references(() => choferes.id, { onDelete: "set null" }),
    viaje_id: fkBigint("viaje_id").references(() => viajes.id, { onDelete: "set null" }),
    estacion_id: fkBigint("estacion_id").references(() => estacionesServicio.id, {
      onDelete: "set null",
    }),
    litros: cantidad("litros").notNull(),
    precio_litro: dinero("precio_litro"),
    importe: dinero("importe").notNull(),
    // Se usa para actualizar camiones.odometro_actual si es mayor al vigente.
    odometro: integer("odometro").notNull(),
    modalidad: modalidadGasoilEnum("modalidad").notNull(),
    // Solo aplica si modalidad = pagado_por_chofer.
    rendido: boolean("rendido"),
    comprobante_nro: text("comprobante_nro"),
    observaciones: text("observaciones"),
  },
  (t) => [
    accesoTotalAutenticados("cargas_gasoil"),
    index("cargas_gasoil_camion_id_idx").on(t.camion_id),
    index("cargas_gasoil_chofer_id_idx").on(t.chofer_id),
    index("cargas_gasoil_viaje_id_idx").on(t.viaje_id),
    index("cargas_gasoil_estacion_id_idx").on(t.estacion_id),
  ]
).enableRLS();
