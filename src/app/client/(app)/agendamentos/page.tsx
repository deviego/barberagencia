import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AppointmentSection, one, type Appt } from "@/features/client/components/appointment-card";
import { formatBRL } from "@/lib/utils";
import { getMyAppointments, getMyReservations } from "@/features/client/data";

const CANCELLED_STATUSES = ["CANCELLED", "EXPIRED"];

interface Reservation {
  id: string;
  qty: number;
  status: string;
  created_at: string;
  products: unknown;
}
const RESERVATION_STATUS: Record<string, { label: string; variant: "accent" | "success" | "neutral" }> = {
  RESERVED: { label: "Aguardando retirada", variant: "accent" },
  PICKED_UP: { label: "Retirado", variant: "success" },
  CANCELLED: { label: "Cancelado", variant: "neutral" },
};

export default async function AgendamentosPage() {
  const [all, reservations] = (await Promise.all([getMyAppointments(), getMyReservations()])) as unknown as [
    Appt[],
    Reservation[],
  ];

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const dayOf = (a: Appt) => format(new Date(a.start_at), "yyyy-MM-dd");
  const active = all.filter((a) => !CANCELLED_STATUSES.includes(a.status));
  const hoje = active.filter((a) => dayOf(a) === todayStr).sort((x, y) => (x.start_at < y.start_at ? -1 : 1));
  const futuros = active.filter((a) => dayOf(a) > todayStr).sort((x, y) => (x.start_at < y.start_at ? -1 : 1));

  const empty = hoje.length === 0 && futuros.length === 0 && reservations.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Meus agendamentos</h1>

      {empty && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-text-muted">
          Você não tem agendamentos próximos.
        </p>
      )}

      <AppointmentSection label="Hoje" items={hoje} highlight actions />
      <AppointmentSection label="Próximos" items={futuros} highlight actions />

      {reservations.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="text-overline uppercase text-text-muted">
            Produtos solicitados <span className="text-text-muted">({reservations.length})</span>
          </div>
          {reservations.map((r) => {
            const p = one(r.products as { name: string; price_brl: number }[] | { name: string; price_brl: number });
            const st = RESERVATION_STATUS[r.status] ?? RESERVATION_STATUS.RESERVED;
            return (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-inset text-accent">
                    <Package size={18} />
                  </span>
                  <div>
                    <div className="text-body font-semibold text-text">
                      {r.qty}x {p?.name ?? "Produto"}
                    </div>
                    <div className="text-caption text-text-muted tabular">
                      {format(new Date(r.created_at), "dd MMM · HH:mm", { locale: ptBR })}
                      {p ? ` · ${formatBRL(p.price_brl * r.qty)}` : ""}
                    </div>
                  </div>
                </div>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
