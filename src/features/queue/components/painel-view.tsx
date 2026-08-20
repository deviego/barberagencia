"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Scissors, CheckCircle2, Clock } from "lucide-react";
import type { QueueBoardItem } from "../data";

/** Painel de chamada (TV): senha(s) em atendimento com o nome, próximas e última atendida. Auto-atualiza. */
export function PainelView({
  name,
  serving,
  waiting,
  lastDone,
  doneCount,
}: {
  name: string;
  serving: QueueBoardItem[];
  waiting: QueueBoardItem[];
  lastDone: QueueBoardItem | null;
  doneCount: number;
}) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent font-display text-h4 font-black text-text-inverse">
            {name.slice(0, 2).toUpperCase()}
          </span>
          <span className="font-display text-h3 uppercase tracking-wide text-text">{name}</span>
        </div>
        {doneCount > 0 && (
          <span className="flex items-center gap-1.5 text-body text-text-2">
            <CheckCircle2 size={18} className="text-success-strong" /> {doneCount} atendida{doneCount > 1 ? "s" : ""} hoje
          </span>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-12 px-6 py-10 text-center">
        {/* Em atendimento */}
        <section className="flex w-full flex-col items-center gap-6">
          <div className="text-overline uppercase tracking-[0.2em] text-text-muted">Chamando agora</div>

          {serving.length > 0 ? (
            <div className="flex flex-wrap items-stretch justify-center gap-6">
              {serving.map((s) => (
                <div
                  key={s.id}
                  className="flex min-w-[280px] flex-col items-center gap-2 rounded-2xl border-2 border-accent bg-accent-wash px-10 py-8 shadow-lg"
                >
                  <span className="font-display text-[128px] font-black leading-none text-accent">#{s.ticket}</span>
                  <span className="text-h2 font-bold text-text">{s.firstName}</span>
                  {s.barber && (
                    <span className="flex items-center gap-1.5 text-h5 text-text-2">
                      <Scissors size={18} /> {s.barber}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Estado vazio — ninguém sendo chamado: mensagem elaborada + última senha atendida
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-surface px-12 py-12 shadow-sm">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-wash text-accent">
                <Clock size={30} />
              </span>
              <div>
                <div className="font-display text-h2 uppercase text-text">Seja bem-vindo(a)!</div>
                <p className="mt-1 text-h5 text-text-2">
                  Nenhuma senha em atendimento no momento. Peça a sua senha e acompanhe o chamado por aqui.
                </p>
              </div>
              {lastDone && (
                <div className="mt-2 flex items-center gap-2 rounded-pill bg-inset px-4 py-2 text-body text-text-2">
                  <CheckCircle2 size={16} className="text-success-strong" />
                  Última senha atendida: <strong className="text-text tabular">#{lastDone.ticket}</strong> · {lastDone.firstName}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Próximas senhas */}
        <section className="flex w-full flex-col items-center gap-4">
          <div className="text-overline uppercase tracking-[0.2em] text-text-muted">Próximas senhas</div>
          {waiting.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-4">
              {waiting.slice(0, 8).map((w) => (
                <div
                  key={w.id}
                  className="flex min-w-[120px] flex-col items-center gap-0.5 rounded-xl border border-border bg-surface px-6 py-4"
                >
                  <span className="font-display text-h2 font-bold text-text tabular">#{w.ticket}</span>
                  <span className="max-w-[140px] truncate text-body text-text-2">{w.firstName}</span>
                </div>
              ))}
              {waiting.length > 8 && <span className="text-h5 text-text-muted">+{waiting.length - 8}</span>}
            </div>
          ) : (
            <p className="text-body text-text-muted">Nenhuma senha aguardando.</p>
          )}
        </section>
      </main>
    </div>
  );
}
