"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { QueueBoardItem } from "../data";

/** Painel de chamada (TV): senha(s) em atendimento + próximas. Auto-atualiza. */
export function PainelView({
  name,
  serving,
  waiting,
}: {
  name: string;
  serving: QueueBoardItem[];
  waiting: QueueBoardItem[];
}) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center gap-10 bg-canvas px-6 py-12 text-center">
      <h1 className="font-display text-h2 uppercase tracking-wide text-text">{name}</h1>

      <div className="flex flex-col items-center gap-2">
        <div className="text-overline uppercase tracking-widest text-text-muted">Em atendimento</div>
        {serving.length ? (
          <div className="flex flex-wrap items-center justify-center gap-8">
            {serving.map((s) => (
              <div key={s.id} className="flex flex-col items-center">
                <span className="font-display text-[120px] font-black leading-none text-accent">#{s.ticket}</span>
                <span className="text-h5 text-text-2">
                  {s.firstName}
                  {s.barber ? ` · ${s.barber}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="font-display text-[96px] font-black leading-none text-text-muted">—</span>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="text-overline uppercase tracking-widest text-text-muted">Próximas senhas</div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {waiting.length ? (
            waiting.slice(0, 8).map((w) => (
              <span key={w.id} className="rounded-lg border border-border bg-surface px-6 py-3 font-display text-h3 font-bold text-text tabular">
                #{w.ticket}
              </span>
            ))
          ) : (
            <span className="text-body text-text-muted">Nenhuma senha aguardando.</span>
          )}
        </div>
      </div>
    </div>
  );
}
