import {
  ArrowRight,
  Bell,
  Calendar,
  CalendarX,
  Check,
  ChevronDown,
  CreditCard,
  Megaphone,
  MessageCircle,
  Minus,
  Monitor,
  Package,
  Phone,
  Plus,
  Scissors,
  Smartphone,
  Star,
  Tablet,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  "arrow-right": ArrowRight,
  bell: Bell,
  calendar: Calendar,
  "calendar-x": CalendarX,
  check: Check,
  "chevron-down": ChevronDown,
  "credit-card": CreditCard,
  megaphone: Megaphone,
  "message-circle": MessageCircle,
  minus: Minus,
  monitor: Monitor,
  package: Package,
  phone: Phone,
  plus: Plus,
  scissors: Scissors,
  smartphone: Smartphone,
  star: Star,
  tablet: Tablet,
  wallet: Wallet,
  x: X,
};

/** Renderiza um ícone Lucide pelo nome (kebab-case) usado no conteúdo da landing. */
export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Cmp = MAP[name] ?? Check;
  return <Cmp size={size} className={className} strokeWidth={2} />;
}
