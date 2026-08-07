import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { accesoTotalAutenticados, dinero, fkBigint, idPk, timestampTz } from "./_helpers";
import { modalidadPagoChoferEnum } from "./enums";

export const camiones = pgTable(
  "camiones",
  {
    id: idPk(),
    dominio_tractor: text("dominio_tractor").notNull(),
    dominio_acoplado: text("dominio_acoplado"),
    marca: text("marca"),
    modelo: text("modelo"),
    anio: integer("anio"),
    n_chasis: text("n_chasis"),
    n_motor: text("n_motor"),
    titular: text("titular"),
    tara_kg: integer("tara_kg"),
    capacidad_kg: integer("capacidad_kg"),
    vto_vtv: timestampTz("vto_vtv"),
    vto_seguro: timestampTz("vto_seguro"),
    aseguradora: text("aseguradora"),
    poliza: text("poliza"),
    vto_ruta: timestampTz("vto_ruta"),
    vto_cnrt: timestampTz("vto_cnrt"),
    vto_senasa: timestampTz("vto_senasa"),
    odometro_actual: integer("odometro_actual"),
    observaciones: text("observaciones"),
    activo: boolean("activo").notNull().default(true),
  },
  () => [accesoTotalAutenticados("camiones")]
).enableRLS();

export const choferes = pgTable(
  "choferes",
  {
    id: idPk(),
    nombre_completo: text("nombre_completo").notNull(),
    cuil: text("cuil"),
    dni: text("dni"),
    telefono: text("telefono"),
    email: text("email"),
    direccion: text("direccion"),
    localidad: text("localidad"),
    licencia_nro: text("licencia_nro"),
    licencia_vto: timestampTz("licencia_vto"),
    linti_vto: timestampTz("linti_vto"),
    modalidad_pago: modalidadPagoChoferEnum("modalidad_pago").default("porcentaje_flete"),
    valor_pago: dinero("valor_pago").default("15"),
    camion_habitual_id: fkBigint("camion_habitual_id").references(() => camiones.id, {
      onDelete: "set null",
    }),
    observaciones: text("observaciones"),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [
    accesoTotalAutenticados("choferes"),
    index("choferes_camion_habitual_id_idx").on(t.camion_habitual_id),
  ]
).enableRLS();
