type Carga = { camion_id: number; litros: string; odometro: number | null };

export function PanelRendimiento({
  cargas,
  camiones,
}: {
  cargas: Carga[];
  camiones: { id: number; nombre: string }[];
}) {
  const porCamion = new Map<number, Carga[]>();
  for (const c of cargas) {
    const lista = porCamion.get(c.camion_id) ?? [];
    lista.push(c);
    porCamion.set(c.camion_id, lista);
  }

  const filas = Array.from(porCamion.entries())
    .map(([camionId, lista]) => {
      const litros = lista.reduce((s, c) => s + Number(c.litros), 0);
      // El odómetro puede quedar sin cargar (llega recién en la
      // liquidación) — esas cargas no aportan al cálculo de km recorridos.
      const odometros = lista
        .map((c) => c.odometro)
        .filter((o): o is number => o != null);
      const km = odometros.length > 0 ? Math.max(...odometros) - Math.min(...odometros) : 0;
      const rendimiento = km > 0 && litros > 0 ? km / litros : null;
      const litrosCada100km = km > 0 && litros > 0 ? (litros / km) * 100 : null;
      return {
        camionId,
        nombre: camiones.find((c) => c.id === camionId)?.nombre ?? "—",
        litros,
        km,
        rendimiento,
        litrosCada100km,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (filas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin cargas para calcular rendimiento.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="p-2 text-left font-medium">Camión</th>
            <th className="p-2 text-left font-medium">Litros cargados</th>
            <th className="p-2 text-left font-medium">Km recorridos</th>
            <th className="p-2 text-left font-medium">Km/L</th>
            <th className="p-2 text-left font-medium">L/100km</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.camionId} className="border-b last:border-0">
              <td className="p-2">{f.nombre}</td>
              <td className="p-2">{f.litros.toLocaleString("es-AR")}</td>
              <td className="p-2">{f.km.toLocaleString("es-AR")}</td>
              <td className="p-2">{f.rendimiento ? f.rendimiento.toFixed(2) : "—"}</td>
              <td className="p-2">{f.litrosCada100km ? f.litrosCada100km.toFixed(1) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
