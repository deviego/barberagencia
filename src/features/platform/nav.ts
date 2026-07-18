import { Building2, CreditCard, Layers, Palette, Plus } from "lucide-react";

export const MASTER_NAV = [
  { href: "/master", label: "Barbearias", icon: Building2 },
  { href: "/master/onboarding", label: "Onboarding", icon: Plus },
  { href: "/master/temas", label: "Temas", icon: Palette },
  { href: "/master/planos-saas", label: "Planos SaaS", icon: Layers },
  { href: "/master/billing", label: "Billing", icon: CreditCard },
] as const;
