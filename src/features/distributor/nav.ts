import { LayoutDashboard, Package, Wallet, Settings } from "lucide-react";

// Clientes entra com o CRM (Fase 1b); Pedidos na Fase 2.
export const DISTRIBUTOR_NAV = [
  { href: "/distributor", label: "Painel", icon: LayoutDashboard },
  { href: "/distributor/produtos", label: "Produtos", icon: Package },
  { href: "/distributor/extrato", label: "Extrato", icon: Wallet },
  { href: "/distributor/config", label: "Conta", icon: Settings },
] as const;
