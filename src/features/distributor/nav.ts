import { LayoutDashboard } from "lucide-react";

// Cresce a cada fase (Produtos/Clientes/Extrato na Fase 1; Pedidos na Fase 2).
export const DISTRIBUTOR_NAV = [
  { href: "/distributor", label: "Painel", icon: LayoutDashboard },
] as const;
