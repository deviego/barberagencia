import { Badge } from "@/components/ui/badge";

export type AppointmentStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "ALT_OFFERED"
  | "EXPIRED"
  | "CANCELLED"
  | "DONE";

const MAP: Record<AppointmentStatus, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  REQUESTED: { label: "Aguardando confirmação", variant: "warning" },
  CONFIRMED: { label: "Confirmado", variant: "success" },
  ALT_OFFERED: { label: "Outro horário oferecido", variant: "info" },
  EXPIRED: { label: "Expirado", variant: "neutral" },
  CANCELLED: { label: "Cancelado", variant: "danger" },
  DONE: { label: "Concluído", variant: "neutral" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const s = MAP[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
