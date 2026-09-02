import {
  Bell,
  CalendarDays,
  Gauge,
  LifeBuoy,
  ListOrdered,
  Package,
  Receipt,
  Scissors,
  Settings,
  Store,
  Truck,
  User,
  Users,
  Wallet,
} from "lucide-react";
import type { FeatureKey } from "@/lib/entitlements";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof Gauge;
  badge?: number;
  /** Se definido, o item só aparece com o entitlement do plano. */
  feature?: FeatureKey;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/solicitacoes", label: "Solicitações", icon: Bell },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/fila", label: "Fila", icon: ListOrdered },
  { href: "/admin/pedidos", label: "Pedidos", icon: Receipt },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/servicos", label: "Serviços", icon: Scissors },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/fornecedores", label: "Fornecedores", icon: Truck },
  { href: "/admin/barbeiros", label: "Barbeiros", icon: User },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/marketing-place", label: "Marketing Place", icon: Store },
  { href: "/admin/suporte", label: "Suporte", icon: LifeBuoy },
  { href: "/admin/config", label: "Configurações", icon: Settings },
];
