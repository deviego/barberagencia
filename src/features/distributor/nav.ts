import { LayoutDashboard, Package, Users, Wallet, Settings } from "lucide-react";

// Pedidos entra na Fase 2 (marketplace).
export const DISTRIBUTOR_NAV = [
  { href: "/distributor", label: "Painel", icon: LayoutDashboard },
  { href: "/distributor/produtos", label: "Produtos", icon: Package },
  { href: "/distributor/clientes", label: "Clientes", icon: Users },
  { href: "/distributor/extrato", label: "Extrato", icon: Wallet },
  { href: "/distributor/config", label: "Conta", icon: Settings },
] as const;
