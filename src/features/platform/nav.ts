import { Building2, Palette, Sparkles, Star, Wallet } from "lucide-react";

export const MASTER_NAV = [
  { href: "/master/planos-saas", label: "Planos SaaS", icon: Star },
  { href: "/master", label: "Barbearias", icon: Building2 },
  { href: "/master/onboarding", label: "Onboarding", icon: Sparkles },
  { href: "/master/temas", label: "Temas", icon: Palette },
  { href: "/master/billing", label: "Billing", icon: Wallet },
] as const;
