import { Card, CardContent } from "@/components/ui/card";

export function TabPlaceholder({ fase }: { fase: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        Esta sección se construye en la {fase}.
      </CardContent>
    </Card>
  );
}
