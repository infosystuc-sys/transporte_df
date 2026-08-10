"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CampoBooleano,
  CampoSelect,
  CampoTexto,
} from "@/components/catalogos/campos-formulario";
import { viajeDatosGeneralesSchema, type ViajeDatosGeneralesInput } from "@/lib/schemas/viajes";

type Opcion = { id: number; nombre: string };
type CamionOpcion = { id: number; dominio_tractor: string; dominio_acoplado: string | null };

const opcionesTipoCarga = [
  { value: "grano", label: "Grano" },
  { value: "otro", label: "Otro" },
];
const opcionesDeclaracion = [
  { value: "conforme", label: "Conforme" },
  { value: "condicional", label: "Condicional" },
];

export function FormularioDatosGenerales({
  valoresIniciales,
  clientes,
  camiones,
  choferes,
  productos,
  lugares,
  alGuardar,
  textoBoton = "Guardar",
}: {
  valoresIniciales: ViajeDatosGeneralesInput;
  clientes: Opcion[];
  camiones: CamionOpcion[];
  choferes: Opcion[];
  productos: Opcion[];
  lugares: Opcion[];
  alGuardar: (valores: ViajeDatosGeneralesInput) => Promise<{ error?: string } | void>;
  textoBoton?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ViajeDatosGeneralesInput>({
    resolver: zodResolver(viajeDatosGeneralesSchema),
    defaultValues: valoresIniciales,
  });

  const tieneCpe = form.watch("tiene_cpe");
  const camionId = form.watch("camion_id");

  useEffect(() => {
    if (!camionId) return;
    const camion = camiones.find((c) => c.id === Number(camionId));
    if (!camion) return;
    form.setValue("dominio_tractor", camion.dominio_tractor);
    form.setValue("dominio_acoplado", camion.dominio_acoplado ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camionId]);

  function onSubmit(valores: ViajeDatosGeneralesInput) {
    startTransition(async () => {
      const resultado = await alGuardar(valores);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Guardado.");
      router.refresh();
    });
  }

  const opciones = (lista: Opcion[]) => lista.map((o) => ({ value: String(o.id), label: o.nombre }));

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoBooleano form={form} name="tiene_cpe" label="Tiene Carta de Porte (CPE)" />
        <CampoSelect form={form} name="tipo_carga" label="Tipo de carga" opciones={opcionesTipoCarga} />
      </div>

      {tieneCpe ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoTexto form={form} name="cpe_nro" label="N° CPE" />
          <CampoTexto form={form} name="ctg" label="CTG" />
          <CampoTexto form={form} name="cpe_fecha_emision" label="Fecha de emisión" tipo="date" />
          <CampoTexto form={form} name="ctg_vencimiento" label="Vencimiento del CTG" tipo="date" />
          <CampoTexto form={form} name="campania" label="Campaña" />
          <CampoSelect
            form={form}
            name="declaracion_calidad"
            label="Declaración de calidad"
            opciones={opcionesDeclaracion}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoTexto form={form} name="remito_nro" label="N° de remito" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
          form={form}
          name="cliente_id"
          label="Cliente (flete pagador)"
          opciones={opciones(clientes)}
        />
        <CampoSelect form={form} name="intermediario_id" label="Intermediario de flete" opciones={opciones(clientes)} />
        <CampoTexto
          form={form}
          name="comision_intermediario_pct"
          label="Comisión del intermediario (%)"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-4">
        <div>
          <h3 className="text-sm font-bold">Datos estadísticos</h3>
          <p className="text-sm text-muted-foreground">
            Titular de la carta de porte y destinatario de la mercadería. Se guardan solo para
            reportes: no se les factura ni se dan de alta como clientes.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoTexto form={form} name="titular_nombre" label="Titular de la carta de porte" />
          <CampoTexto form={form} name="titular_cuit" label="CUIT del titular" />
          <CampoTexto form={form} name="destinatario_nombre" label="Destinatario" />
          <CampoTexto form={form} name="destinatario_cuit" label="CUIT del destinatario" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
          form={form}
          name="camion_id"
          label="Camión"
          opciones={camiones.map((c) => ({ value: String(c.id), label: c.dominio_tractor }))}
        />
        <CampoSelect form={form} name="chofer_id" label="Chofer" opciones={opciones(choferes)} />
        <CampoTexto form={form} name="dominio_tractor" label="Dominio tractor" />
        <CampoTexto form={form} name="dominio_acoplado" label="Dominio acoplado" />
        <CampoSelect form={form} name="producto_id" label="Producto" opciones={opciones(productos)} />
        <CampoTexto form={form} name="km" label="Km a recorrer" tipo="number" />
        <CampoSelect form={form} name="origen_id" label="Origen" opciones={opciones(lugares)} />
        <CampoSelect form={form} name="destino_id" label="Destino" opciones={opciones(lugares)} />
      </div>

      <CampoTexto form={form} name="observaciones" label="Observaciones" textarea />

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : textoBoton}
        </Button>
      </div>
    </form>
  );
}
