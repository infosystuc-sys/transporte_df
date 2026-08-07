export type NavItem = {
  href: string;
  label: string;
  disponible: boolean;
};

// A medida que se construya cada fase del punto 8 del spec, se marca
// disponible: true y deja de mostrarse como "Próximamente".
export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", disponible: true },
  { href: "/viajes", label: "Viajes", disponible: true },
  { href: "/clientes", label: "Clientes", disponible: true },
  { href: "/camiones", label: "Camiones", disponible: true },
  { href: "/choferes", label: "Choferes", disponible: true },
  { href: "/tarifario", label: "Tarifario", disponible: true },
  { href: "/gasoil", label: "Gasoil", disponible: true },
  { href: "/cobros", label: "Cobros", disponible: true },
  { href: "/liquidaciones", label: "Liquidaciones", disponible: true },
  { href: "/reportes", label: "Reportes", disponible: false },
  { href: "/configuracion", label: "Configuración", disponible: true },
];
