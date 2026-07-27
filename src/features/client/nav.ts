import { CalendarPlus, CreditCard, Home, Receipt, User } from "lucide-react";

export const CLIENT_NAV = [
  { href: "/client", label: "Início", icon: Home },
  { href: "/client/servicos", label: "Agendar", icon: CalendarPlus },
  { href: "/client/pedidos", label: "Pedidos", icon: Receipt },
  { href: "/client/meu-plano", label: "Meu plano", icon: CreditCard },
  { href: "/client/perfil", label: "Perfil", icon: User },
] as const;
