import { Bell, CalendarDays, QrCode, Scissors, Ticket, Tv } from "lucide-react";

/**
 * Mocks ilustrativos da landing v2. Só dado fictício ("Barbearia Teste"), sem QR real.
 * São decorativos (aria-hidden): o texto que importa para busca e leitor de tela está nas seções.
 */

const ROW = "flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-inset px-3 py-2";

export function AgendaMock({ className = "" }: { className?: string }) {
  const rows = [
    { h: "09:00", who: "Cliente 1", what: "Corte", tone: "var(--bb-success)" },
    { h: "09:40", who: "Cliente 2", what: "Corte + barba", tone: "var(--bb-accent)" },
    { h: "10:30", who: "Livre", what: "", tone: "var(--bb-border)" },
  ];
  return (
    <div aria-hidden="true" className={`lv2-float w-[250px] p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-text-2">
        <CalendarDays size={15} className="text-accent" />
        Agenda de hoje
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.h} className={ROW}>
            <span className="font-display text-[17px] font-extrabold text-text">{r.h}</span>
            <span className="flex-1 truncate text-[12px] text-text-2">
              {r.who}
              {r.what && <span className="text-text-muted"> · {r.what}</span>}
            </span>
            <span className="h-2 w-2 rounded-full" style={{ background: r.tone }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TurnMock({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`lv2-float w-[220px] p-4 text-center ${className}`}>
      <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        <Bell size={13} className="text-accent" />
        Fila · Barbearia Teste
      </div>
      <div className="mt-2 font-display text-[54px] font-black leading-none text-accent">#7</div>
      <div className="mt-1 text-[15px] font-bold text-text">É a sua vez!</div>
    </div>
  );
}

export function PlanMock({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`lv2-float w-[230px] p-4 ${className}`}>
      <div className="flex items-center gap-2 text-[12px] font-semibold text-text-2">
        <Scissors size={14} className="text-accent" />
        Combo mensal
      </div>
      <div className="mt-2 flex items-end justify-between">
        <span className="font-display text-[34px] font-black leading-none text-text">3 de 4</span>
        <span className="text-[11px] text-text-muted">cortes no saldo</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-inset">
        <div className="h-full w-3/4 rounded-full bg-accent" />
      </div>
    </div>
  );
}

/** Telas da jornada da fila (uma por passo de QUEUE_STEPS). */
export function QueueVisual({ step }: { step: 0 | 1 | 2 }) {
  if (step === 0) {
    return (
      <div aria-hidden="true" className="lv2-float mx-auto flex w-full max-w-[340px] flex-col items-center gap-4 p-7 text-center">
        <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-muted">Barbearia Teste</div>
        <div className="flex h-36 w-36 items-center justify-center rounded-2xl border border-border bg-inset text-text-muted">
          <QrCode size={84} strokeWidth={1.2} />
        </div>
        <div className="text-[15px] font-semibold text-text">Entre na fila pelo celular</div>
        <div className="w-full rounded-xl bg-accent py-3 text-[14px] font-bold text-text-inverse">Entrar na fila</div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div aria-hidden="true" className="lv2-float mx-auto flex w-full max-w-[340px] flex-col items-center gap-3 p-7 text-center">
        <Ticket size={26} className="text-accent" />
        <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-muted">Sua senha</div>
        <div className="font-display text-[88px] font-black leading-none text-text">#7</div>
        <div className="text-[14px] text-text-2">3 pessoas na sua frente · Corte</div>
        <div className="mt-1 flex w-full justify-between rounded-xl border border-border-subtle bg-inset px-4 py-3 text-[13px]">
          <span className="text-text-muted">Barbeiro</span>
          <span className="font-semibold text-text">Sem preferência</span>
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="lv2-float mx-auto w-full max-w-[460px] p-6">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        <Tv size={15} className="text-accent" />
        Painel da TV
      </div>
      <div className="mt-4 rounded-2xl border border-accent bg-accent-wash p-5 text-center">
        <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-2">Chamando</div>
        <div className="font-display text-[72px] font-black leading-none text-accent">#7</div>
        <div className="mt-1 text-[16px] font-bold text-text">É a sua vez!</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {["#8", "#9", "#10"].map((s) => (
          <div key={s} className="rounded-xl border border-border-subtle bg-inset py-2.5">
            <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Próxima</div>
            <div className="font-display text-[26px] font-extrabold text-text">{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
