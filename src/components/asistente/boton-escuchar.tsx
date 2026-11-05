"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";

const sinSuscripcion = () => () => {};

/** La voz en español más cercana a la de Argentina que tenga el dispositivo. */
function vozEspanol(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis.getVoices();
  return (
    voces.find((v) => v.lang === "es-AR") ??
    voces.find((v) => v.lang === "es-US" || v.lang === "es-419" || v.lang === "es-MX") ??
    voces.find((v) => v.lang.startsWith("es"))
  );
}

/**
 * 🔊 en cada respuesta de Félix: la lee en voz alta con la voz del propio
 * dispositivo (sin costo). Útil para David manejando o en el campo.
 */
export function BotonEscuchar({ texto }: { texto: string }) {
  const disponible = useSyncExternalStore(sinSuscripcion, () => "speechSynthesis" in window, () => false);
  const [hablando, setHablando] = useState(false);

  // Si se cierra el chat o se borra la charla, se corta la lectura.
  useEffect(() => () => {
    if (hablando) window.speechSynthesis.cancel();
  }, [hablando]);

  if (!disponible) return null;

  function alternar() {
    const sintesis = window.speechSynthesis;
    if (hablando) {
      sintesis.cancel();
      setHablando(false);
      return;
    }
    sintesis.cancel(); // corta otra respuesta que se esté leyendo
    const limpio = texto
      .replace(/\*\*/g, "")
      .replace(/^\s*-\s+/gm, "")
      .replace(/#(\d+)/g, "número $1");
    const lectura = new SpeechSynthesisUtterance(limpio);
    lectura.lang = "es-AR";
    const voz = vozEspanol();
    if (voz) lectura.voice = voz;
    lectura.onend = lectura.onerror = () => setHablando(false);
    setHablando(true);
    sintesis.speak(lectura);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      aria-label={hablando ? "Dejar de escuchar" : "Escuchar la respuesta"}
    >
      {hablando ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}
      {hablando ? "Parar" : "Escuchar"}
    </button>
  );
}
