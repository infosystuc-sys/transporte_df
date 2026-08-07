import { Badge } from "@/components/ui/badge";

export function BadgeActivo({ activo }: { activo: boolean }) {
  return (
    <Badge variant={activo ? "default" : "secondary"}>{activo ? "Activo" : "Inactivo"}</Badge>
  );
}
