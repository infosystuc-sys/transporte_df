import {
  LayoutDashboard,
  Route,
  Users,
  Truck,
  IdCard,
  Receipt,
  Fuel,
  Wallet,
  FileCheck,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  disponible: boolean;
  icono: LucideIcon;
};

// A medida que se construya cada fase del punto 8 del spec, se marca
// disponible: true y deja de mostrarse como "Próximamente".
export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", disponible: true, icono: LayoutDashboard },
  { href: "/viajes", label: "Viajes", disponible: true, icono: Route },
  { href: "/clientes", label: "Clientes", disponible: true, icono: Users },
  { href: "/camiones", label: "Camiones", disponible: true, icono: Truck },
  { href: "/choferes", label: "Choferes", disponible: true, icono: IdCard },
  { href: "/tarifario", label: "Tarifario", disponible: true, icono: Receipt },
  { href: "/gasoil", label: "Gasoil", disponible: true, icono: Fuel },
  { href: "/cobros", label: "Cobros", disponible: true, icono: Wallet },
  { href: "/liquidaciones", label: "Liquidaciones", disponible: true, icono: FileCheck },
  { href: "/reportes", label: "Reportes", disponible: true, icono: BarChart3 },
  { href: "/configuracion", label: "Configuración", disponible: true, icono: Settings },
];
