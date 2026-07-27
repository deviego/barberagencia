"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/** Faixa no topo do painel com o período de teste e contagem regressiva. */
export function TrialBanner({ endsAt }: { endsAt: string }) {
  const target = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now === null) return null; // evita divergência de hidratação (server x client)

  const diff = target - now;
  const ended = diff <= 0;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateLabel = new Date(endsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-accent px-4 py-1.5 text-center text-caption font-semibold text-text-inverse">
      <span className="flex items-center gap-1.5">
        <Clock size={14} />
        Período de teste gratuito até {dateLabel}
      </span>
      {ended ? (
        <span>· período encerrado — fale com o suporte para ativar</span>
      ) : (
        <span className="tabular">
          · termina em {d}d {pad(h)}:{pad(m)}:{pad(s)}
        </span>
      )}
    </div>
  );
}
