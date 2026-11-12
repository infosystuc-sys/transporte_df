"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, Check, Loader2, Mic, Paperclip, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { prepararArchivoParaSubir } from "@/lib/archivos/preparar-subida";
import type { Propuesta } from "@/lib/asistente/acciones";
import { BotonEscuchar } from "./boton-escuchar";
import { useNotaDeVoz } from "./use-nota-de-voz";

type EstadoAccion = "pendiente" | "guardando" | "hecha" | "cancelada";
type AccionChat = { propuesta: Propuesta; estado: EstadoAccion; error?: string };
type Turno = {
  rol: "usuario" | "felix";
  texto: string;
  error?: boolean;
  audio?: boolean;
  /** Nombre de la foto/PDF que se mandó con el mensaje. */
  adjunto?: string;
  acciones?: AccionChat[];
};

const CLAVE_HISTORIAL = "felix:historial";
const SUGERENCIAS = [
  "¿Qué viajes quedan pendientes de facturar?",
  "¿Cuánto lleva ganado Portillo hasta la fecha?",
  "Cargá gasoil a Naranjo: 400 litros a $ 1.150",
  "¿Qué viajes están pendientes de cobrar?",
  "¿Qué viaje está rechazado?",
];
// Un "sí" o un "no" corto (escrito o dictado) responde a las tarjetas pendientes.
// Sin números: "sí, pero eran 500 litros" es una corrección y va a Félix.
const AFIRMATIVO =
  /^(?!.*\d)(s[ií]+|dale|ok|okey|confirm(o|á|a|ar|alo|alas|alos)?|cargal[oa]s?|hacel[oa]|listo|perfecto|de una|correcto|guardal[oa]s?)(?=[\s,.!¡]|$)[\s,.!¡]*([a-záéíóúñ]+[\s,.!]*){0,2}$/i;
const NEGATIVO = /^(no+|cancel(á|a|ar|alo|ala|alos)|dejal[oa]|olvidal[oa])([\s,.!]+(gracias|cancel(á|a)|dejalo|nada))?[\s,.!]*$/i;

/** **negrita** dentro de una línea. */
function Linea({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>
      )}
    </>
  );
}

function TarjetaAccion({
  accion,
  alConfirmar,
  alCancelar,
}: {
  accion: AccionChat;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  const { propuesta, estado } = accion;
  return (
    <div
      className={`rounded-xl border bg-card p-3 text-sm shadow-sm ${estado === "cancelada" ? "opacity-60" : ""} ${
        estado === "hecha" ? "border-emerald-500/50" : ""
      }`}
    >
      <p className="font-semibold">{propuesta.titulo}</p>
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {propuesta.detalle.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
      {propuesta.avisos.length > 0 && (
        <ul className="mt-2 space-y-0.5 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-300">
          {propuesta.avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      {accion.error && <p className="mt-2 text-xs text-destructive">{accion.error}</p>}
      <div className="mt-3 flex items-center gap-2">
        {estado === "pendiente" && (
          <>
            <Button size="sm" onClick={alConfirmar} variant={propuesta.tipo === "eliminar_viaje" ? "destructive" : "default"}>
              <Check className="size-4" /> {propuesta.tipo === "eliminar_viaje" ? "Borrar" : "Confirmar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={alCancelar}>
              Cancelar
            </Button>
          </>
        )}
        {estado === "guardando" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Guardando…
          </span>
        )}
        {estado === "hecha" && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Guardado ✓</span>}
        {estado === "cancelada" && <span className="text-xs text-muted-foreground">Cancelado</span>}
      </div>
    </div>
  );
}

function Burbuja({
  turno,
  alConfirmar,
  alCancelar,
}: {
  turno: Turno;
  alConfirmar?: (i: number) => void;
  alCancelar?: (i: number) => void;
}) {
  const deFelix = turno.rol === "felix";
  return (
    <div className={deFelix ? "flex items-end gap-2" : "flex justify-end"}>
      {deFelix && (
        <Image src="/asistente/felix-256.png" alt="" width={28} height={28} className="size-7 shrink-0 self-start rounded-full" />
      )}
      <div className="flex max-w-[85%] flex-col gap-2">
        <div
          className={
            deFelix
              ? `rounded-2xl rounded-bl-sm px-3 py-2 ${turno.error ? "bg-destructive/10 text-destructive" : "bg-muted"}`
              : "rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground"
          }
        >
          {(turno.audio || turno.adjunto) && (
            <span className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px] opacity-80">
              {turno.audio && (
                <span className="flex items-center gap-1">
                  <Mic className="size-3" /> Nota de voz
                </span>
              )}
              {turno.adjunto && (
                <span className="flex items-center gap-1">
                  <Paperclip className="size-3" /> {turno.adjunto}
                </span>
              )}
            </span>
          )}
          {turno.texto.split("\n").map((linea, i) => (
            <p key={i} className={linea.trim() === "" ? "h-2" : "break-words"}>
              <Linea texto={linea} />
            </p>
          ))}
          {deFelix && !turno.error && <BotonEscuchar texto={turno.texto} />}
        </div>
        {turno.acciones?.map((a, i) => (
          <TarjetaAccion key={i} accion={a} alConfirmar={() => alConfirmar?.(i)} alCancelar={() => alCancelar?.(i)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Botón flotante con la cara de Félix y el chat. Está en todas las
 * pantallas de la app (layout). El historial queda en este navegador.
 * Las cargas que prepara Félix aparecen como tarjetas: nada se guarda
 * hasta que se toca Confirmar (o se contesta "sí").
 */
export function ChatFelix() {
  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  // Foto/PDF del comprobante: se manda con cada mensaje hasta que se use o se quite.
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  const selectorArchivo = useRef<HTMLInputElement>(null);
  const turnosRef = useRef<Turno[]>([]);
  const adjuntoRef = useRef<File | null>(null);
  const voz = useNotaDeVoz((transcripto) => enviar(transcripto, true));
  const ocupado = pensando || voz.estado === "transcribiendo";

  useEffect(() => {
    turnosRef.current = turnos;
  }, [turnos]);
  useEffect(() => {
    adjuntoRef.current = adjunto;
  }, [adjunto]);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_HISTORIAL);
      if (guardado) {
        const leidos = (JSON.parse(guardado) as Turno[]).map((t) => ({
          ...t,
          // Si se cerró a mitad de un guardado, la tarjeta vuelve a quedar para confirmar.
          acciones: t.acciones?.map((a) => (a.estado === "guardando" ? { ...a, estado: "pendiente" as const } : a)),
        }));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee una sola vez al montar
        setTurnos(leidos);
      }
    } catch {
      // Sin almacenamiento (modo privado): el chat arranca vacío.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(turnos.slice(-40)));
    } catch {
      // Idem: no se guarda, pero el chat funciona igual.
    }
    fin.current?.scrollIntoView({ behavior: "smooth" });
  }, [turnos, pensando]);

  function cambiarAccion(turnoIdx: number, accionIdx: number, cambios: Partial<AccionChat>) {
    setTurnos((prev) =>
      prev.map((t, i) =>
        i === turnoIdx ? { ...t, acciones: t.acciones?.map((a, j) => (j === accionIdx ? { ...a, ...cambios } : a)) } : t
      )
    );
  }

  async function confirmar(turnoIdx: number, accionIdx: number) {
    const accion = turnosRef.current[turnoIdx]?.acciones?.[accionIdx];
    if (!accion || accion.estado !== "pendiente") return;
    cambiarAccion(turnoIdx, accionIdx, { estado: "guardando", error: undefined });
    const { tipo, datos } = accion.propuesta;
    const form = new FormData();
    form.set("accion", JSON.stringify({ tipo, datos }));
    const usaArchivo = "con_comprobante" in datos && datos.con_comprobante;
    if (usaArchivo && adjuntoRef.current) form.set("archivo", adjuntoRef.current);
    try {
      const res = await fetch("/api/asistente/accion", { method: "POST", body: form });
      const r = (await res.json().catch(() => ({}))) as { mensaje?: string; error?: string };
      if (!res.ok || !r.mensaje) {
        cambiarAccion(turnoIdx, accionIdx, { estado: "pendiente", error: r.error ?? "No se pudo guardar. Probá de nuevo." });
        return;
      }
      cambiarAccion(turnoIdx, accionIdx, { estado: "hecha" });
      setTurnos((prev) => [...prev, { rol: "felix", texto: `✅ ${r.mensaje}` }]);
      if (usaArchivo) setAdjunto(null);
    } catch {
      cambiarAccion(turnoIdx, accionIdx, { estado: "pendiente", error: "No hay conexión. Probá de nuevo." });
    }
  }

  function cancelar(turnoIdx: number, accionIdx: number) {
    cambiarAccion(turnoIdx, accionIdx, { estado: "cancelada", error: undefined });
  }

  /** Tarjetas sin confirmar de la última respuesta de Félix. */
  function pendientes(): { turnoIdx: number; accionIdx: number }[] {
    const lista = turnosRef.current;
    const turnoIdx = lista.findLastIndex((t) => t.rol === "felix" && !t.error && !t.texto.startsWith("✅"));
    const turno = lista[turnoIdx];
    return (turno?.acciones ?? []).flatMap((a, accionIdx) => (a.estado === "pendiente" ? [{ turnoIdx, accionIdx }] : []));
  }

  async function enviar(pregunta: string, audio = false) {
    const limpia = pregunta.trim();
    if (!limpia || pensando) return;
    const turnoUsuario: Turno = { rol: "usuario", texto: limpia, ...(audio ? { audio: true } : {}) };

    // "Sí" / "No" con tarjetas pendientes: se responde a las tarjetas, sin ir a la IA.
    const aResponder = pendientes();
    if (aResponder.length > 0 && (AFIRMATIVO.test(limpia) || NEGATIVO.test(limpia))) {
      setTurnos((prev) => [...prev, turnoUsuario]);
      setTexto("");
      for (const p of aResponder) {
        if (AFIRMATIVO.test(limpia)) await confirmar(p.turnoIdx, p.accionIdx);
        else cancelar(p.turnoIdx, p.accionIdx);
      }
      return;
    }

    const archivo = adjuntoRef.current;
    const nuevos: Turno[] = [...turnosRef.current, { ...turnoUsuario, ...(archivo ? { adjunto: archivo.name } : {}) }];
    setTurnos(nuevos);
    setTexto("");
    setPensando(true);
    try {
      // Los errores no se mandan: Félix no los dijo.
      const historial = nuevos.filter((t) => !t.error).map(({ rol, texto }) => ({ rol, texto }));
      let cuerpo: BodyInit;
      const headers: HeadersInit = {};
      if (archivo) {
        const form = new FormData();
        form.set("historial", JSON.stringify(historial));
        form.set("archivo", archivo);
        cuerpo = form;
      } else {
        cuerpo = JSON.stringify({ historial });
        headers["content-type"] = "application/json";
      }
      const res = await fetch("/api/asistente", { method: "POST", headers, body: cuerpo });
      const datos = (await res.json().catch(() => ({}))) as { texto?: string; error?: string; acciones?: Propuesta[] };
      setTurnos((prev) => [
        ...prev,
        datos.texto
          ? {
              rol: "felix",
              texto: datos.texto,
              ...(datos.acciones?.length
                ? { acciones: datos.acciones.map((propuesta) => ({ propuesta, estado: "pendiente" as const })) }
                : {}),
            }
          : { rol: "felix", texto: datos.error ?? "No pude responder. Probá de nuevo.", error: true },
      ]);
    } catch {
      setTurnos((prev) => [...prev, { rol: "felix", texto: "No hay conexión. Probá de nuevo en un rato.", error: true }]);
    } finally {
      setPensando(false);
    }
  }

  async function elegirArchivo(archivo: File | undefined) {
    if (!archivo) return;
    setAdjunto(await prepararArchivoParaSubir(archivo));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border bg-card p-1 sm:pr-4 shadow-lg transition hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Preguntale a Félix"
      >
        <Image src="/asistente/felix-256.png" alt="" width={48} height={48} className="size-12 rounded-full" priority={false} />
        <span className="hidden text-sm font-bold sm:inline">Preguntale a Félix</span>
      </button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="flex-row items-center gap-3 border-b p-4 pr-12">
            <Image src="/asistente/felix-256.png" alt="" width={44} height={44} className="size-11 rounded-full" />
            <div className="min-w-0 flex-1">
              <SheetTitle>Félix</SheetTitle>
              <SheetDescription>Consulta y carga gasoil, cargas, descargas y tarifas</SheetDescription>
            </div>
            {turnos.length > 0 && (
              <Button variant="ghost" size="icon-sm" onClick={() => setTurnos([])} disabled={pensando} aria-label="Nueva charla" title="Nueva charla">
                <RotateCcw className="size-4" />
              </Button>
            )}
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 text-sm">
            {turnos.length === 0 && (
              <div className="flex flex-col gap-3">
                <Burbuja
                  turno={{
                    rol: "felix",
                    texto:
                      "¡Hola! Soy Félix. Preguntame lo que necesites de los viajes, choferes, camiones, gasoil o cobranzas. También puedo cargar gasoil (con texto o una foto del ticket), la carga o descarga de un viaje y cambiar tarifas: te lo preparo y vos lo confirmás.",
                  }}
                />
                <p className="text-xs text-muted-foreground">Por ejemplo:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => enviar(s)}
                      className="rounded-full border px-3 py-1 text-left text-xs hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {turnos.map((t, i) => (
              <Burbuja
                key={i}
                turno={t}
                alConfirmar={(j) => void confirmar(i, j)}
                alCancelar={(j) => cancelar(i, j)}
              />
            ))}
            {pensando && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {adjunto ? "Félix está leyendo el comprobante…" : "Félix está buscando…"}
              </div>
            )}
            <div ref={fin} />
          </div>

          {voz.aviso && (
            <div className="flex items-start justify-between gap-2 border-t bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span>{voz.aviso}</span>
              <button type="button" className="shrink-0 underline" onClick={() => voz.setAviso(null)}>
                Cerrar
              </button>
            </div>
          )}
          {adjunto && (
            <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
              <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                <Paperclip className="size-3.5 shrink-0" />
                <span className="truncate">{adjunto.name}</span>
                <span className="shrink-0">· va con tu próximo mensaje</span>
              </span>
              <button type="button" onClick={() => setAdjunto(null)} aria-label="Quitar el archivo" className="shrink-0">
                <X className="size-4" />
              </button>
            </div>
          )}
          <form
            className="flex items-end gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
          >
            <input
              ref={selectorArchivo}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                void elegirArchivo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {voz.estado !== "grabando" && voz.estado !== "transcribiendo" && (
              <Button
                type="button"
                size="icon-lg"
                variant="ghost"
                disabled={ocupado}
                onClick={() => selectorArchivo.current?.click()}
                aria-label="Mandar una foto o PDF de un comprobante"
                title="Mandar una foto o PDF de un comprobante"
              >
                <Camera className="size-5" />
              </Button>
            )}
            {voz.estado === "grabando" ? (
              <div className="flex min-h-10 flex-1 items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 text-sm">
                <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
                <span className="font-medium tabular-nums">
                  {Math.floor(voz.segundos / 60)}:{String(voz.segundos % 60).padStart(2, "0")}
                </span>
                <span className="text-muted-foreground">Grabando… soltá para enviar</span>
              </div>
            ) : voz.estado === "transcribiendo" ? (
              <div className="flex min-h-10 flex-1 items-center gap-2 px-1 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Escuchando tu audio…
              </div>
            ) : (
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar(texto);
                  }
                }}
                placeholder={adjunto ? "Contale qué es (ej. gasoil de Naranjo)…" : "Escribile o mandale un audio a Félix…"}
                rows={1}
                className="max-h-32 min-h-10 resize-none"
                disabled={ocupado}
              />
            )}
            {texto.trim() ? (
              <Button type="submit" size="icon-lg" disabled={ocupado} aria-label="Enviar">
                <Send className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon-lg"
                variant={voz.estado === "grabando" ? "destructive" : "default"}
                disabled={ocupado}
                aria-label="Mantené apretado para grabar un audio"
                title="Mantené apretado para grabar un audio"
                className={`touch-none select-none ${voz.estado === "grabando" ? "scale-125" : ""}`}
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  void voz.empezar();
                }}
                onPointerUp={() => voz.terminar(true)}
                onPointerCancel={() => voz.terminar(false)}
              >
                <Mic className="size-4" />
              </Button>
            )}
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
