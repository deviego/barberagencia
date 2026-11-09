"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ticket, LogOut, Scissors, User, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { joinQueue, leaveQueue } from "../actions";
import type { MyTicket, QueueBoardItem } from "../data";

type SvcOpt = { id: string; name: string; priceBrl: number };
type BarberOpt = { id: string; name: string };

function PlanPill() {
  return (
    <span className="rounded-pill bg-accent-wash px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
      Plano
    </span>
  );
}

/** Linha do quadro da fila: rótulo + senha(s) com nome e selo de plano. */
function BoardLine({ label, entries, accent }: { label: string; entries: QueueBoardItem[]; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-caption uppercase text-text-muted">{label}</span>
      {entries.length === 0 ? (
        <span className="text-body text-text-muted">—</span>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1">
          {entries.map((e) => (
            <span key={e.id} className="flex items-center gap-1.5">
              <span className={cn("font-display text-h5 font-bold tabular", accent ? "text-accent" : "text-text")}>#{e.ticket}</span>
              <span className="text-caption text-text-2">{e.firstName}</span>
              {e.hasPlan && <PlanPill />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tela da fila do cliente: sua senha + quadro (último/atendimento/próximo) + seleção. */
export function FilaView({
  tenantId,
  ticket,
  serving,
  lastCalled,
  next,
  services,
  barbers,
  pickBarber,
}: {
  tenantId: string;
  ticket: MyTicket | null;
  serving: QueueBoardItem[];
  lastCalled: QueueBoardItem | null;
  next: QueueBoardItem | null;
  services: SvcOpt[];
  barbers: BarberOpt[];
  pickBarber: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [service, setService] = useState<string | null>(ticket?.serviceId ?? null);
  const [barber, setBarber] = useState<string | null>(ticket?.barberId ?? null);

  // Atualiza a "senha em atendimento" a cada 12s (acompanhar a fila ao vivo).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 12000);
    return () => clearInterval(t);
  }, [router]);

  // Entrar na fila só ao clicar (não é mais automático) — pega a senha na hora.
  function join() {
    startTransition(async () => {
      await joinQueue(tenantId, service, barber);
      router.refresh();
    });
  }

  // Enquanto já está na fila, mudar serviço/barbeiro atualiza a mesma senha.
  function saveSelection(nextService: string | null, nextBarber: string | null) {
    if (!ticket) return;
    startTransition(async () => {
      await joinQueue(tenantId, nextService, nextBarber);
      router.refresh();
    });
  }

  function leave() {
    if (!ticket) return;
    startTransition(async () => {
      await leaveQueue(ticket.id);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      {/* Senha do cliente — ou convite para entrar na fila */}
      {ticket ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-6 text-center">
          <div className="flex items-center gap-1.5 text-caption uppercase text-text-muted">
            <Ticket size={14} /> Sua senha
          </div>
          <div className="font-display text-[64px] font-black leading-none text-accent">#{ticket.ticket}</div>
          <div className="text-caption text-text-2">
            {ticket.status === "IN_SERVICE" ? "É a sua vez! 💈" : "Aguarde ser chamado"}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6 text-center">
          <div className="flex items-center gap-1.5 text-caption uppercase text-text-muted">
            <Ticket size={14} /> Fila de atendimento
          </div>
          <p className="text-body text-text-2">
            Escolha o serviço (opcional) abaixo e entre na fila. Você recebe sua senha na hora e acompanha por aqui.
          </p>
          <Button size="lg" onClick={join} loading={pending} className="w-full">
            <ListPlus size={18} /> Entrar na fila
          </Button>
        </div>
      )}

      {/* Quadro da fila: último chamado, em atendimento e próximo */}
      <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border bg-surface">
        <BoardLine label="Último chamado" entries={lastCalled ? [lastCalled] : []} />
        <BoardLine label="Em atendimento" entries={serving} />
        <BoardLine label="Próximo" entries={next ? [next] : []} accent />
      </div>

      {/* Seleção de serviço */}
      {services.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-caption font-semibold text-text-2">
            <Scissors size={14} /> Serviço
          </div>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  const v = service === s.id ? null : s.id;
                  setService(v);
                  saveSelection(v, barber);
                }}
                className={`rounded-pill border px-3.5 py-1.5 text-caption transition-colors ${
                  service === s.id ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
                }`}
              >
                {s.name} · {formatBRL(s.priceBrl)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Seleção de barbeiro (se a barbearia permitir) */}
      {pickBarber && barbers.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-caption font-semibold text-text-2">
            <User size={14} /> Barbeiro
          </div>
          <div className="flex flex-wrap gap-2">
            {barbers.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  const v = barber === b.id ? null : b.id;
                  setBarber(v);
                  saveSelection(service, v);
                }}
                className={`rounded-pill border px-3.5 py-1.5 text-caption transition-colors ${
                  barber === b.id ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {ticket && (
        <Button variant="outline" onClick={leave} loading={pending} className="w-fit self-center">
          <LogOut size={15} /> Sair da fila
        </Button>
      )}
    </div>
  );
}
