import {
  Bell,
  CalendarDays,
  Gauge,
  Megaphone,
  Package,
  Scissors,
  Settings,
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
  { href: "/admin/solicitacoes", label: "Solicitações", icon: Bell, badge: 2 },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/servicos", label: "Serviços", icon: Scissors },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/barbeiros", label: "Barbeiros", icon: User },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone, feature: "marketing.basic" },
  { href: "/admin/config", label: "Configurações", icon: Settings },
];
