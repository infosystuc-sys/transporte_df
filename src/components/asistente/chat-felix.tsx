"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Mic, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { BotonEscuchar } from "./boton-escuchar";
import { useNotaDeVoz } from "./use-nota-de-voz";

type Turno = { rol: "usuario" | "felix"; texto: string; error?: boolean; audio?: boolean };

const CLAVE_HISTORIAL = "felix:historial";
const SUGERENCIAS = [
  "¿Qué viajes quedan pendientes de facturar?",
  "¿Cuánto lleva ganado Portillo hasta la fecha?",
  "¿Cuántos adelantos tiene Guerra a la fecha?",
  "¿Qué viajes están pendientes de cobrar?",
  "¿Qué viaje está rechazado?",
];

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

function Burbuja({ turno }: { turno: Turno }) {
  const deFelix = turno.rol === "felix";
  return (
    <div className={deFelix ? "flex items-end gap-2" : "flex justify-end"}>
      {deFelix && (
        <Image src="/asistente/felix-256.png" alt="" width={28} height={28} className="size-7 shrink-0 rounded-full" />
      )}
      <div
        className={
          deFelix
            ? `max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 ${turno.error ? "bg-destructive/10 text-destructive" : "bg-muted"}`
            : "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground"
        }
      >
        {turno.audio && (
          <span className="mb-0.5 flex items-center gap-1 text-[11px] opacity-80">
            <Mic className="size-3" /> Nota de voz
          </span>
        )}
        {turno.texto.split("\n").map((linea, i) => (
          <p key={i} className={linea.trim() === "" ? "h-2" : "break-words"}>
            <Linea texto={linea} />
          </p>
        ))}
        {deFelix && !turno.error && <BotonEscuchar texto={turno.texto} />}
      </div>
    </div>
  );
}

/**
 * Botón flotante con la cara de Félix y el chat. Está en todas las
 * pantallas de la app (layout). El historial queda en este navegador.
 */
export function ChatFelix() {
  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const voz = useNotaDeVoz((transcripto) => enviar(transcripto, true));
  const ocupado = pensando || voz.estado === "transcribiendo";

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_HISTORIAL);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee una sola vez al montar
      if (guardado) setTurnos(JSON.parse(guardado) as Turno[]);
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

  async function enviar(pregunta: string, audio = false) {
    const limpia = pregunta.trim();
    if (!limpia || pensando) return;
    const nuevos: Turno[] = [...turnos, { rol: "usuario", texto: limpia, ...(audio ? { audio: true } : {}) }];
    setTurnos(nuevos);
    setTexto("");
    setPensando(true);
    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Los errores no se mandan: Félix no los dijo.
          historial: nuevos.filter((t) => !t.error).map(({ rol, texto }) => ({ rol, texto })),
        }),
      });
      const datos = (await res.json().catch(() => ({}))) as { texto?: string; error?: string };
      setTurnos((prev) => [
        ...prev,
        datos.texto
          ? { rol: "felix", texto: datos.texto }
          : { rol: "felix", texto: datos.error ?? "No pude responder. Probá de nuevo.", error: true },
      ]);
    } catch {
      setTurnos((prev) => [...prev, { rol: "felix", texto: "No hay conexión. Probá de nuevo en un rato.", error: true }]);
    } finally {
      setPensando(false);
    }
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
              <SheetDescription>Asistente de la app · por ahora solo consulta</SheetDescription>
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
                    texto: "¡Hola! Soy Félix. Preguntame lo que necesites de los viajes, choferes, camiones, gasoil o cobranzas y lo busco en la app.",
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
              <Burbuja key={i} turno={t} />
            ))}
            {pensando && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Félix está buscando…
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
          <form
            className="flex items-end gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
          >
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
                placeholder="Escribile o mandale un audio a Félix…"
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
