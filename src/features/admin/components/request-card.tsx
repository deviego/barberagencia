"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Baby, Check, Clock, MessageCircle, NotebookPen, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { paymentLabel } from "@/lib/payment";
import { waLink } from "@/lib/contact";
import { fillTemplate, getTemplate, APP_LINK } from "@/features/messages/templates";
import { acceptAppointment, expireAppointment } from "@/features/admin/actions";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export interface ComandaItem {
  kind: string;
  name: string;
  price_brl: number;
  qty: number;
  covered_by_plan: boolean;
}

export interface RequestRow {
  id: string;
  start_at: string;
  request_expires_at: string | null;
  consumed_from_plan: boolean;
  clients: { name: string; phone?: string | null } | { name: string; phone?: string | null }[] | null;
  barbers: { name: string } | { name: string }[] | null;
  services: { name: string } | { name: string }[] | null;
  combo_plans: { name: string } | { name: string }[] | null;
  children?: { name: string; age?: number | null } | { name: string; age?: number | null }[] | null;
  observations?: string | null;
  appointment_items?: ComandaItem[] | null;
  payment_method?: string | null;
}

export function RequestCard({ req, tenantName = "nossa barbearia" }: { req: RequestRow; tenantName?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const client = one(req.clients);
  const barber = one(req.barbers);
  const service = one(req.services) ?? one(req.combo_plans);
  const child = one(req.children ?? null);
  const items = req.appointment_items ?? [];
  const total = items.reduce((s, it) => (it.covered_by_plan ? s : s + it.price_brl * it.qty), 0);
  const phone = (client as { phone?: string | null } | null)?.phone ?? null;
  const waText = fillTemplate(getTemplate("confirmed")?.body ?? "", { nome: client?.name ?? "", link: APP_LINK, barbearia: tenantName });

  const expiresMs = req.request_expires_at ? new Date(req.request_expires_at).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.floor((expiresMs - now) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const danger = seconds <= 120;
  const pct = Math.min(100, (seconds / 600) * 100);

  function accept() {
    startTransition(async () => {
      await acceptAppointment(req.id);
      router.refresh();
    });
  }
  function expire() {
    startTransition(async () => {
      await expireAppointment(req.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-inset text-accent">
            <Scissors size={18} />
          </span>
          <div>
            <div className="text-body font-semibold text-text">{client?.name ?? "Cliente"}</div>
            <div className="text-caption text-text-muted">
              {service?.name ?? "Serviço"}
              {barber ? ` · ${barber.name}` : ""}
            </div>
          </div>
        </div>
        {req.consumed_from_plan ? <Badge variant="accent">Plano</Badge> : <Badge>Avulso</Badge>}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-body text-text-2 tabular">
          {format(new Date(req.start_at), "EEE, dd MMM · HH:mm", { locale: ptBR })}
        </span>
        {req.payment_method && (
          <span className="rounded-pill border border-border px-2 py-0.5 text-caption text-text-2">
            💳 {paymentLabel(req.payment_method)}
          </span>
        )}
      </div>

      {child && (
        <div className="flex items-center gap-2 rounded-md border border-accent bg-accent-wash px-3 py-2 text-caption text-accent">
          <Baby size={15} />
          <span>
            Corte infantil para <strong>{child.name}</strong>
            {child.age != null ? ` (${child.age} anos)` : ""}
          </span>
        </div>
      )}

      {req.observations && (
        <div className="flex items-start gap-2 rounded-md border border-border-subtle bg-inset px-3 py-2 text-caption text-text-2">
          <NotebookPen size={15} className="mt-0.5 flex-shrink-0 text-text-muted" />
          <span>
            <span className="font-semibold text-text">Observações: </span>
            {req.observations}
          </span>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-border-subtle p-3">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-caption">
              <span className="text-text-2">
                {it.qty > 1 ? `${it.qty}x ` : ""}
                {it.name}
              </span>
              {it.covered_by_plan ? (
                <span className="font-semibold text-accent">Plano</span>
              ) : (
                <span className="tabular text-text">{formatBRL(it.price_brl * it.qty)}</span>
              )}
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-border-subtle pt-1.5 text-caption">
            <span className="font-semibold text-text">A receber no local</span>
            <span className="tabular font-bold text-accent">{formatBRL(total)}</span>
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between text-caption">
          <span className="flex items-center gap-1 text-text-muted">
            <Clock size={13} /> Tempo para confirmar
          </span>
          <span className={`tabular font-semibold ${danger ? "text-danger" : "text-text"}`}>
            {mm}:{ss}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-pill bg-inset">
          <div
            className="h-full rounded-pill transition-all"
            style={{ width: `${pct}%`, background: danger ? "var(--bb-danger)" : "var(--bb-accent)" }}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button className="flex-1" loading={pending} onClick={accept}>
          <Check size={16} />
          Aceitar
        </Button>
        <Button variant="ghost" className="flex-1" disabled={pending} onClick={expire}>
          Liberar horário
        </Button>
      </div>

      {phone && (
        <a
          href={waLink(phone, waText)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-caption font-semibold text-white transition-transform hover:scale-[1.01]"
          style={{ background: "#25D366" }}
        >
          <MessageCircle size={15} />
          Avisar no WhatsApp
        </a>
      )}
    </div>
  );
}
