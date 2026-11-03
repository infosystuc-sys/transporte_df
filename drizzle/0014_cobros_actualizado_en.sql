ALTER TABLE "cobros" ADD COLUMN "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- El Cash Flow detecta cambios por esta columna: la actualiza la base en
-- cada UPDATE, así no depende de que cada pantalla se acuerde de tocarla.
CREATE OR REPLACE FUNCTION "public"."cobros_set_actualizado_en"() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "cobros_set_actualizado_en" BEFORE UPDATE ON "public"."cobros"
  FOR EACH ROW EXECUTE FUNCTION "public"."cobros_set_actualizado_en"();
