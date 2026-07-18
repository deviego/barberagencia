import { CalendarClock, Home, Scissors, User } from "lucide-react";

export const CLIENT_NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/servicos", label: "Serviços", icon: Scissors },
  { href: "/agendamentos", label: "Agenda", icon: CalendarClock },
  { href: "/perfil", label: "Perfil", icon: User },
] as const;
