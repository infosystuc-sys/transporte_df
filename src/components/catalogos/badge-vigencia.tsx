import { Badge } from "@/components/ui/badge";

type EstadoVigencia = "vigente" | "vencida" | "futura" | "inactiva";

export function calcularVigencia(
  activo: boolean,
  desde: Date,
  hasta: Date | null
): EstadoVigencia {
  if (!activo) return "inactiva";
  const hoy = new Date();
  if (desde > hoy) return "futura";
  if (hasta && hasta < hoy) return "vencida";
  return "vigente";
}

const ETIQUETAS: Record<EstadoVigencia, string> = {
  vigente: "Vigente",
  vencida: "Vencida",
  futura: "Futura",
  inactiva: "Inactiva",
};

const VARIANTES: Record<EstadoVigencia, "default" | "secondary" | "outline" | "destructive"> = {
  vigente: "default",
  vencida: "destructive",
  futura: "outline",
  inactiva: "secondary",
};

export function BadgeVigencia({
  activo,
  desde,
  hasta,
}: {
  activo: boolean;
  desde: Date;
  hasta: Date | null;
}) {
  const estado = calcularVigencia(activo, desde, hasta);
  return <Badge variant={VARIANTES[estado]}>{ETIQUETAS[estado]}</Badge>;
}
