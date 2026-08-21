import { Building2, FileText, LayoutDashboard, Palette, Sparkles, Star, Wallet } from "lucide-react";

export const MASTER_NAV = [
  { href: "/master", label: "Painel", icon: LayoutDashboard },
  { href: "/master/barbearias", label: "Barbearias", icon: Building2 },
  { href: "/master/relatorios", label: "Relatórios", icon: FileText },
  { href: "/master/onboarding", label: "Onboarding", icon: Sparkles },
  { href: "/master/planos-saas", label: "Planos SaaS", icon: Star },
  { href: "/master/billing", label: "Billing", icon: Wallet },
  { href: "/master/temas", label: "Temas", icon: Palette },
] as const;
