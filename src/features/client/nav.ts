import { CalendarPlus, CreditCard, Home, User } from "lucide-react";

export const CLIENT_NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/servicos", label: "Agendar", icon: CalendarPlus },
  { href: "/meu-plano", label: "Meu plano", icon: CreditCard },
  { href: "/perfil", label: "Perfil", icon: User },
] as const;
