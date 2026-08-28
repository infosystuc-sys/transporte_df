"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogosImportacionCpe } from "@/lib/cpe/datos-catalogos";
import type { ResultadoImportacionCpe } from "@/lib/cpe/importar";
import { viajeDesdeCpeSchema, type ViajeDesdeCpeInput } from "@/lib/schemas/cpe-importacion";
import {
  agruparFaltantes,
  calcularHuellaFaltante,
  construirValoresIniciales,
  CamposRevisionCpe,
  DialogCrearRapido,
  type GrupoFaltante,
  type Opcion,
  type TipoEntidad,
} from "../../importar-cpe/_componentes/campos-revision-cpe";
import {
  confirmarImportacionCpeEnTanda,
  crearEntidadesFaltantes,
  importarCpe,
  verificarCtgExistente,
} from "../../importar-cpe/actions";

export type EstadoItem = "pendiente" | "procesando" | "listo" | "revisar" | "error" | "confirmado";

export type ItemLote = {
  id: string;
  archivo: File;
  estado: EstadoItem;
  resultado: ResultadoImportacionCpe | null;
  error: string | null;
  viajeId: number | null;
  ctgDuplicadoEnLote: boolean;
  ctgYaExisteViajeNro: number | null;
};

const ETIQUETAS_ESTADO: Record<EstadoItem, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando...",
  listo: "Listo",
  revisar: "Revisar",
  error: "Error",
  confirmado: "Confirmado",
};

export function ImportadorMasivoCpe({
  clientes,
  camiones,
  choferes,
  productos,
  lugares,
  configDefaults,
}: CatalogosImportacionCpe) {
  const [items, setItems] = useState<ItemLote[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [idAbierto, setIdAbierto] = useState<string | null>(null);
  const [isPendingFaltantes, startTransitionFaltantes] = useTransition();
  const [isPendingConfirmar, startTransitionConfirmar] = useTransition();

  const [opcionesClientes, setOpcionesClientes] = useState<Opcion[]>(() =>
    clientes.map((c) => ({ value: String(c.id), label: c.nombre }))
  );
  const [opcionesCamiones, setOpcionesCamiones] = useState<Opcion[]>(() =>
    camiones.map((c) => ({ value: String(c.id), label: c.dominio_tractor }))
  );
  const [opcionesChoferes, setOpcionesChoferes] = useState<Opcion[]>(() =>
    choferes.map((c) => ({ value: String(c.id), label: c.nombre }))
  );
  const [opcionesLugares, setOpcionesLugares] = useState<Opcion[]>(() =>
    lugares.map((l) => ({ value: String(l.id), label: l.nombre }))
  );
  const [opcionesProductos, setOpcionesProductos] = useState<Opcion[]>(() =>
    productos.map((p) => ({ value: String(p.id), label: p.nombre }))
  );

  const [dialog, setDialog] = useState<{
    tipo: TipoEntidad;
    titulo: string;
    nombre: string;
    extra: string;
    campo: Path<ViajeDesdeCpeInput>;
  } | null>(null);

  const form = useForm<ViajeDesdeCpeInput>({ resolver: zodResolver(viajeDesdeCpeSchema) });

  const itemAbierto = items.find((it) => it.id === idAbierto) ?? null;

  const todosListos = items.length > 0 && !procesando;
  const grupos = useMemo(
    () => agruparFaltantes(items.flatMap((it) => it.resultado?.faltantes ?? [])),
    [items]
  );

  function actualizarItem(id: string, cambios: Partial<ItemLote>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  function agregarOpcion(tipo: TipoEntidad, id: number, nombre: string) {
    const opcion = { value: String(id), label: nombre };
    const sumar = (prev: Opcion[]) =>
      prev.some((o) => o.value === opcion.value) ? prev : [...prev, opcion];
    if (tipo === "cliente") setOpcionesClientes(sumar);
    if (tipo === "camion") setOpcionesCamiones(sumar);
    if (tipo === "chofer") setOpcionesChoferes(sumar);
    if (tipo === "lugar") setOpcionesLugares(sumar);
    if (tipo === "producto") setOpcionesProductos(sumar);
  }

  async function procesarUno(item: ItemLote) {
    actualizarItem(item.id, { estado: "procesando" });
    try {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      const r = await importarCpe(formData);
      const necesitaRevision = r.motivoManual != null || r.extraido.campos_dudosos.length > 0;

      const ctg = r.extraido.ctg ?? r.referenciaQr;
      const viajesExistentes = ctg ? await verificarCtgExistente(ctg) : [];

      actualizarItem(item.id, {
        estado: necesitaRevision ? "revisar" : "listo",
        resultado: r,
        ctgYaExisteViajeNro: viajesExistentes[0]?.numero ?? null,
      });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      actualizarItem(item.id, { estado: "error", error: mensaje });
    }
  }

  async function onSeleccionarArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    const nuevosItems: ItemLote[] = archivos.map((archivo) => ({
      id: crypto.randomUUID(),
      archivo,
      estado: "pendiente",
      resultado: null,
      error: null,
      viajeId: null,
      ctgDuplicadoEnLote: false,
      ctgYaExisteViajeNro: null,
    }));
    setItems(nuevosItems);
    setIdAbierto(null);
    e.target.value = "";

    setProcesando(true);
    for (const item of nuevosItems) {
      await procesarUno(item);
    }
    setProcesando(false);
  }

  // CTG repetido DENTRO del lote (además de contra la base, ya chequeado
  // por item en procesarUno): se recalcula acá porque depende de ver
  // todos los items juntos, no de uno solo.
  useEffect(() => {
    if (procesando) return;
    setItems((prev) => {
      const conteo = new Map<string, number>();
      for (const it of prev) {
        const ctg = it.resultado?.extraido.ctg ?? it.resultado?.referenciaQr;
        if (!ctg) continue;
        conteo.set(ctg, (conteo.get(ctg) ?? 0) + 1);
      }
      return prev.map((it) => {
        const ctg = it.resultado?.extraido.ctg ?? it.resultado?.referenciaQr;
        const duplicado = !!ctg && (conteo.get(ctg) ?? 0) > 1;
        return duplicado === it.ctgDuplicadoEnLote ? it : { ...it, ctgDuplicadoEnLote: duplicado };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesando]);

  function darDeAltaFaltantesGlobal() {
    startTransitionFaltantes(async () => {
      const faltantesConClavePrefijada = items.flatMap(
        (it) => it.resultado?.faltantes.map((f) => ({ ...f, clave: `${it.id}:${f.clave}` })) ?? []
      );
      if (faltantesConClavePrefijada.length === 0) return;

      const r = await crearEntidadesFaltantes({ faltantes: faltantesConClavePrefijada });
      if (r.error || !r.creadas) {
        toast.error(r.error ?? "No se pudieron dar de alta los registros.");
        return;
      }
      const creadas = r.creadas;

      for (const g of grupos) {
        for (const it of items) {
          const f = it.resultado?.faltantes.find((x) => calcularHuellaFaltante(x) === g.huella);
          const id = f ? creadas[`${it.id}:${f.clave}`] : undefined;
          if (id != null) {
            agregarOpcion(g.tipo, id, g.nombre);
            break;
          }
        }
      }

      setItems((prev) =>
        prev.map((it) => {
          if (!it.resultado) return it;
          const coincidencias = { ...it.resultado.coincidencias };
          const faltantesRestantes = it.resultado.faltantes.filter((f) => {
            const id = creadas[`${it.id}:${f.clave}`];
            if (id == null) return true;
            (coincidencias as Record<string, number | null>)[f.campo] = id;
            return false;
          });
          return { ...it, resultado: { ...it.resultado, coincidencias, faltantes: faltantesRestantes } };
        })
      );

      toast.success(
        grupos.length === 1 ? "Se dio de alta 1 registro." : `Se dieron de alta ${grupos.length} registros.`
      );
    });
  }

  function descartarFaltantesGlobal() {
    setItems((prev) =>
      prev.map((it) => (it.resultado ? { ...it, resultado: { ...it.resultado, faltantes: [] } } : it))
    );
  }

  function abrirDetalle(item: ItemLote) {
    if (!item.resultado) return;
    setIdAbierto(item.id);
    form.reset(construirValoresIniciales(item.resultado, clientes, configDefaults));
  }

  function cerrarDetalle() {
    setIdAbierto(null);
  }

  async function confirmarValores(itemId: string, valores: ViajeDesdeCpeInput) {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    startTransitionConfirmar(async () => {
      const formData = new FormData();
      formData.set("archivo", item.archivo);
      formData.set("datos", JSON.stringify(valores));
      const r = await confirmarImportacionCpeEnTanda(formData);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      actualizarItem(itemId, { estado: "confirmado", viajeId: r.viajeId });
      toast.success(`Viaje #${r.viajeId} creado.`);
      if (idAbierto === itemId) setIdAbierto(null);
    });
  }

  function confirmarRapido(item: ItemLote) {
    if (!item.resultado) return;
    const valores = construirValoresIniciales(item.resultado, clientes, configDefaults);
    confirmarValores(item.id, valores);
  }

  function abrirCrear(tipo: TipoEntidad, titulo: string, nombre: string, extra: string, campo: Path<ViajeDesdeCpeInput>) {
    setDialog({ tipo, titulo, nombre, extra, campo });
  }

  function onCreado(id: number, nombre: string) {
    if (!dialog || !itemAbierto) return;
    form.setValue(dialog.campo, id as never);
    agregarOpcion(dialog.tipo, id, nombre);
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemAbierto.id && it.resultado
          ? { ...it, resultado: { ...it.resultado, faltantes: it.resultado.faltantes.filter((f) => f.campo !== dialog.campo) } }
          : it
      )
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivos-cpe">Archivos o fotos de las CPE</Label>
          <Input
            id="archivos-cpe"
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            onChange={onSeleccionarArchivos}
            disabled={procesando}
          />
        </div>
      </div>

      {todosListos && grupos.length > 0 && (
        <div className="flex flex-col gap-3 rounded-md border border-amber/40 bg-amber/10 p-4">
          <div>
            <h3 className="text-sm font-bold">
              {grupos.length === 1 ? "Falta dar de alta 1 registro" : `Faltan dar de alta ${grupos.length} registros`}
            </h3>
            <p className="text-sm text-muted-foreground">
              Contando todos los archivos de esta tanda. Revisá que estén bien leídos y confirmá
              para crearlos y dejarlos asignados a los viajes que los necesitan.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {grupos.map((g: GrupoFaltante) => (
              <li key={g.huella} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md bg-card p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{g.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.documento && `${g.documento} · `}usar como {g.roles.join(", ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={darDeAltaFaltantesGlobal} disabled={isPendingFaltantes}>
              {isPendingFaltantes ? "Dando de alta..." : grupos.length === 1 ? "Dar de alta 1 registro" : `Dar de alta los ${grupos.length}`}
            </Button>
            <button type="button" onClick={descartarFaltantesGlobal} className="text-xs text-muted-foreground hover:underline">
              Los cargo a mano
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border p-4">
          <h3 className="text-sm font-bold">{items.length} archivo(s)</h3>
          <ul className="flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.id} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{it.archivo.name}</span>
                    {it.resultado && (
                      <span className="text-xs text-muted-foreground">
                        {it.resultado.extraido.pagador_nombre ?? "—"} · {it.resultado.extraido.chofer_nombre ?? "—"} ·{" "}
                        {it.resultado.extraido.dominio_tractor ?? "—"} · CTG {it.resultado.extraido.ctg ?? it.resultado.referenciaQr ?? "—"}
                      </span>
                    )}
                    {it.ctgDuplicadoEnLote && (
                      <span className="text-xs text-destructive">CTG repetido en esta misma tanda.</span>
                    )}
                    {it.ctgYaExisteViajeNro != null && (
                      <span className="text-xs text-destructive">
                        Ya existe el viaje #{it.ctgYaExisteViajeNro} con este CTG.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {ETIQUETAS_ESTADO[it.estado]}
                      {it.estado === "error" && it.error ? ` — ${it.error}` : ""}
                    </span>
                    {it.estado === "listo" && (
                      <Button size="sm" onClick={() => confirmarRapido(it)} disabled={isPendingConfirmar}>
                        Confirmar
                      </Button>
                    )}
                    {(it.estado === "listo" || it.estado === "revisar") && (
                      <Button size="sm" variant="outline" onClick={() => abrirDetalle(it)}>
                        Ver detalle
                      </Button>
                    )}
                    {it.estado === "error" && (
                      <Button size="sm" variant="outline" onClick={() => procesarUno(it)}>
                        Reintentar
                      </Button>
                    )}
                    {it.estado === "confirmado" && it.viajeId != null && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/viajes/${it.viajeId}`}>Ver viaje #{it.viajeId}</Link>
                      </Button>
                    )}
                  </div>
                </div>

                {idAbierto === it.id && it.resultado && (
                  <form
                    onSubmit={form.handleSubmit((valores) => confirmarValores(it.id, valores))}
                    className="flex flex-col gap-4 border-t pt-4"
                  >
                    <CamposRevisionCpe
                      form={form}
                      resultado={it.resultado}
                      grupos={[]}
                      isPendingFaltantes={false}
                      onDarDeAltaFaltantes={() => {}}
                      onDescartarFaltantes={() => {}}
                      opcionesClientes={opcionesClientes}
                      opcionesCamiones={opcionesCamiones}
                      opcionesChoferes={opcionesChoferes}
                      opcionesProductos={opcionesProductos}
                      opcionesLugares={opcionesLugares}
                      onAbrirCrear={abrirCrear}
                    />
                    <div className="flex gap-3">
                      <Button type="submit" disabled={isPendingConfirmar}>
                        {isPendingConfirmar ? "Creando viaje..." : "Confirmar y crear viaje"}
                      </Button>
                      <Button type="button" variant="outline" onClick={cerrarDetalle}>
                        Cerrar
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogCrearRapido dialog={dialog} onOpenChange={(v) => !v && setDialog(null)} onCreado={onCreado} />
    </div>
  );
}
