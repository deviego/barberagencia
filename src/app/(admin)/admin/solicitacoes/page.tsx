"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { REQUESTS } from "@/features/admin/mock-data";

const ALT_SLOTS = ["16:00", "16:45", "17:30", "18:15"];

export default function SolicitacoesPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-h3 font-bold text-text">Solicitações de agendamento</h1>
        <p className="text-body text-text-2">
          Confirme em até 10 minutos ou ofereça outro horário. Sem resposta, o horário é liberado.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {REQUESTS.map((r) => (
          <RequestCard key={r.id} req={r} />
        ))}
      </div>

      <RefundsPanel />
    </div>
  );
}

const REFUNDS = [
  { id: "rf1", client: "William Santos", detail: "Cancelou Combo Mensal 02", action: "Devolver 1 corte ao saldo", cta: "Aprovar devolução" },
  { id: "rf2", client: "João Silva", detail: "Cancelou Barba Especial (avulso · PIX)", action: "Estornar R$ 40,00", cta: "Aprovar estorno" },
];

function RefundsPanel() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <div>
        <div className="text-overline uppercase text-text-muted">Cancelamentos & reembolsos</div>
        <p className="text-caption text-text-muted">
          Cancelamento até 2h antes = reembolso integral; cortes de plano voltam ao saldo.
        </p>
      </div>
      {REFUNDS.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle px-4 py-3"
        >
          <div>
            <div className="text-body font-semibold text-text">{r.client}</div>
            <div className="text-caption text-text-muted">
              {r.detail} · {r.action}
            </div>
          </div>
          {done[r.id] ? (
            <Badge variant="success">Aprovado</Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setDone((d) => ({ ...d, [r.id]: true }))}>
              {r.cta}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function RequestCard({ req }: { req: (typeof REQUESTS)[number] }) {
  const [seconds, setSeconds] = useState(req.secondsLeft);
  const [resolved, setResolved] = useState<null | "accepted" | "expired" | "offered">(null);
  const [offering, setOffering] = useState(false);

  useEffect(() => {
    if (resolved) return;
    if (seconds <= 0) {
      setResolved("expired");
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, resolved]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const pct = (seconds / 600) * 100;
  const danger = seconds <= 120;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-inset text-accent">
            <Scissors size={18} />
          </span>
          <div>
            <div className="text-body font-semibold text-text">{req.client}</div>
            <div className="text-caption text-text-muted">
              {req.service} · {req.barber}
            </div>
          </div>
        </div>
        {req.plan ? <Badge variant="accent">Plano · {req.balance}</Badge> : <Badge>Avulso</Badge>}
      </div>

      <div className="text-body text-text-2 tabular">{req.slot}</div>

      {/* Timer */}
      {!resolved && (
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
      )}

      {resolved === "accepted" && <Badge variant="success">Confirmado — cliente notificado</Badge>}
      {resolved === "offered" && <Badge variant="info">Novo horário oferecido</Badge>}
      {resolved === "expired" && <Badge variant="neutral">Expirado — horário liberado</Badge>}

      {!resolved && !offering && (
        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => setResolved("accepted")}>
            <Check size={16} />
            Aceitar
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setOffering(true)}>
            Oferecer outro horário
          </Button>
        </div>
      )}

      {!resolved && offering && (
        <div className="flex flex-col gap-2">
          <div className="text-caption text-text-muted">Horários livres do barbeiro:</div>
          <div className="flex flex-wrap gap-2">
            {ALT_SLOTS.map((s) => (
              <button
                key={s}
                onClick={() => setResolved("offered")}
                className="rounded-md border border-border px-3 py-1.5 text-body tabular text-text transition-colors hover:border-accent hover:text-accent"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
