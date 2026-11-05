"use client";

import { useEffect, useRef, useState } from "react";

const DURACION_MINIMA_MS = 800;
const DURACION_MAXIMA_MS = 60_000;

/** El formato que graba cada navegador: Chrome/Android webm, iPhone mp4. */
function formatoGrabacion(): { mime: string; extension: string } {
  if (typeof MediaRecorder === "undefined") return { mime: "", extension: "webm" };
  for (const [mime, extension] of [
    ["audio/webm;codecs=opus", "webm"],
    ["audio/webm", "webm"],
    ["audio/mp4", "m4a"],
    ["audio/ogg;codecs=opus", "ogg"],
  ] as const) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, extension };
  }
  return { mime: "", extension: "webm" };
}

type Estado = "libre" | "pidiendo-permiso" | "grabando" | "transcribiendo";

/**
 * Nota de voz como en WhatsApp: se mantiene apretado el micrófono, se habla
 * y al soltar se manda. El audio se transcribe en el servidor
 * (/api/asistente/transcribir) y el texto vuelve por `alTranscribir`.
 */
export function useNotaDeVoz(alTranscribir: (texto: string) => void) {
  const [estado, setEstado] = useState<Estado>("libre");
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const grabador = useRef<MediaRecorder | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const partes = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);
  const tope = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soltado = useRef(false);
  const callback = useRef(alTranscribir);
  callback.current = alTranscribir;

  function liberar() {
    if (reloj.current) clearInterval(reloj.current);
    if (tope.current) clearTimeout(tope.current);
    reloj.current = tope.current = null;
    flujo.current?.getTracks().forEach((t) => t.stop());
    flujo.current = null;
    grabador.current = null;
  }

  // Si se cierra el chat grabando, se suelta el micrófono.
  useEffect(() => () => liberar(), []);

  async function transcribir(audio: Blob, extension: string) {
    setEstado("transcribiendo");
    try {
      const formData = new FormData();
      formData.set("audio", new File([audio], `nota-de-voz.${extension}`, { type: audio.type }));
      const res = await fetch("/api/asistente/transcribir", { method: "POST", body: formData });
      const datos = (await res.json().catch(() => ({}))) as { texto?: string; error?: string };
      if (datos.texto) callback.current(datos.texto);
      else setAviso(datos.error ?? "No se pudo pasar el audio a texto. Probá de nuevo o escribilo.");
    } catch {
      setAviso("No hay conexión. Probá de nuevo en un rato.");
    } finally {
      setEstado("libre");
    }
  }

  async function empezar() {
    if (estado !== "libre") return;
    setAviso(null);
    soltado.current = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAviso("Este navegador no permite grabar audio. Probá escribiendo.");
      return;
    }
    setEstado("pidiendo-permiso");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setEstado("libre");
      setAviso("Habilitá el permiso del micrófono para este sitio y probá de nuevo.");
      return;
    }
    // Soltó el botón mientras aparecía el cartel de permiso: no se graba nada.
    if (soltado.current) {
      stream.getTracks().forEach((t) => t.stop());
      setEstado("libre");
      setAviso("Listo, ya podés grabar: mantené apretado el micrófono mientras hablás.");
      return;
    }

    const { mime, extension } = formatoGrabacion();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    flujo.current = stream;
    grabador.current = rec;
    partes.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) partes.current.push(e.data);
    };
    rec.onstop = () => {
      const duracion = Date.now() - inicio.current;
      const audio = new Blob(partes.current, { type: rec.mimeType || mime || "audio/webm" });
      const enviar = (rec as MediaRecorder & { enviar?: boolean }).enviar !== false;
      liberar();
      if (!enviar) {
        setEstado("libre");
        return;
      }
      if (duracion < DURACION_MINIMA_MS) {
        setEstado("libre");
        setAviso("Mantené apretado el micrófono mientras hablás.");
        return;
      }
      void transcribir(audio, extension);
    };
    inicio.current = Date.now();
    setSegundos(0);
    rec.start();
    setEstado("grabando");
    reloj.current = setInterval(() => setSegundos(Math.floor((Date.now() - inicio.current) / 1000)), 250);
    tope.current = setTimeout(() => terminar(true), DURACION_MAXIMA_MS);
  }

  /** Al soltar: manda el audio (o lo descarta si `enviar` es false). */
  function terminar(enviar: boolean) {
    soltado.current = true;
    const rec = grabador.current;
    if (!rec || rec.state === "inactive") return;
    (rec as MediaRecorder & { enviar?: boolean }).enviar = enviar;
    rec.stop();
  }

  return { estado, segundos, aviso, setAviso, empezar, terminar };
}
