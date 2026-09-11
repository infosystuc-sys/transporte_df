import { redirect } from "next/navigation";

// Pantalla de entrada de la app: el trabajo del día a día empieza en
// Viajes, no en el Dashboard -- pedido explícito del cliente. El
// Dashboard sigue existiendo en /dashboard, accesible desde el menú.
export default function RaizPage() {
  redirect("/viajes");
}
