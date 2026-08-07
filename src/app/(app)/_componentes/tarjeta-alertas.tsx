import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function TarjetaAlertas({
  titulo,
  vacio,
  items,
}: {
  titulo: string;
  vacio: string;
  items: { href: string; texto: string; detalle: string }[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground">{titulo}</CardTitle>
        {items.length > 0 && <Badge variant="destructive">{items.length}</Badge>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vacio}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.slice(0, 6).map((item, i) => (
              <li key={i}>
                <Link href={item.href} className="flex items-center justify-between gap-3 text-sm hover:underline">
                  <span>{item.texto}</span>
                  <span className="shrink-0 text-muted-foreground">{item.detalle}</span>
                </Link>
              </li>
            ))}
            {items.length > 6 && (
              <li className="text-xs text-muted-foreground">y {items.length - 6} más…</li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
