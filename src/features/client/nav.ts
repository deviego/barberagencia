import { CalendarPlus, Clock, CreditCard, Home, Receipt, User } from "lucide-react";

export const CLIENT_NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/servicos", label: "Agendar", icon: CalendarPlus },
  { href: "/pedidos", label: "Pedidos", icon: Receipt },
  { href: "/meu-plano", label: "Meu plano", icon: CreditCard },
  { href: "/historico", label: "Histórico", icon: Clock },
  { href: "/perfil", label: "Perfil", icon: User },
] as const;
