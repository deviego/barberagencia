import { Building2, FileText, Handshake, LayoutDashboard, Palette, Sparkles, Star, Truck, Wallet } from "lucide-react";

export const MASTER_NAV = [
  { href: "/master", label: "Painel", icon: LayoutDashboard },
  { href: "/master/barbearias", label: "Barbearias", icon: Building2 },
  { href: "/master/distribuidores", label: "Distribuidores", icon: Truck },
  { href: "/master/parceiros", label: "Parceiros", icon: Handshake },
  { href: "/master/relatorios", label: "Relatórios", icon: FileText },
  { href: "/master/onboarding", label: "Onboarding", icon: Sparkles },
  { href: "/master/planos-saas", label: "Planos SaaS", icon: Star },
  { href: "/master/billing", label: "Billing", icon: Wallet },
  { href: "/master/temas", label: "Temas", icon: Palette },
] as const;
