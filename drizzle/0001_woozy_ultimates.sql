ALTER TABLE "condiciones_pago" ADD CONSTRAINT "condiciones_pago_nombre_unique" UNIQUE("nombre");--> statement-breakpoint
ALTER TABLE "estaciones_servicio" ADD CONSTRAINT "estaciones_servicio_nombre_unique" UNIQUE("nombre");--> statement-breakpoint
ALTER TABLE "medios_pago" ADD CONSTRAINT "medios_pago_nombre_unique" UNIQUE("nombre");--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_nombre_unique" UNIQUE("nombre");--> statement-breakpoint
ALTER TABLE "tipos_adicional" ADD CONSTRAINT "tipos_adicional_nombre_unique" UNIQUE("nombre");--> statement-breakpoint
ALTER TABLE "tipos_contingencia" ADD CONSTRAINT "tipos_contingencia_nombre_unique" UNIQUE("nombre");--> statement-breakpoint
ALTER TABLE "tipos_gasto" ADD CONSTRAINT "tipos_gasto_nombre_unique" UNIQUE("nombre");