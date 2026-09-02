import { LayoutDashboard, Package, ShoppingCart, Users, Wallet, Settings } from "lucide-react";

export const DISTRIBUTOR_NAV = [
  { href: "/distributor", label: "Painel", icon: LayoutDashboard },
  { href: "/distributor/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/distributor/produtos", label: "Produtos", icon: Package },
  { href: "/distributor/clientes", label: "Clientes", icon: Users },
  { href: "/distributor/extrato", label: "Extrato", icon: Wallet },
  { href: "/distributor/config", label: "Conta", icon: Settings },
] as const;
