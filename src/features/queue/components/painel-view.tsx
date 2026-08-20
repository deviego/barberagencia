"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors, CheckCircle2, Clock, Volume2, BellRing } from "lucide-react";
import type { QueueBoardItem } from "../data";

/** Painel de chamada (TV): senhas em atendimento com nome, próximas e última atendida.
 *  Ao "Chamar" uma senha no admin, o painel toca um sino e destaca a senha. Auto-atualiza. */
export function PainelView({
  name,
  serving,
  waiting,
  lastDone,
  lastCalled,
  doneCount,
}: {
  name: string;
  serving: QueueBoardItem[];
  waiting: QueueBoardItem[];
  lastDone: QueueBoardItem | null;
  lastCalled: QueueBoardItem | null;
  doneCount: number;
}) {
  const router = useRouter();
  const [soundOn, setSoundOn] = useState(false);
  const [alert, setAlert] = useState<QueueBoardItem | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastCalledKeyRef = useRef<string | null>(lastCalled ? `${lastCalled.id}@${lastCalled.calledAt}` : null);
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Atualiza o painel periodicamente.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [router]);

  // Toca um sino (Web Audio — sem depender de arquivo). Precisa de gesto p/ liberar o áudio.
  function chime() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    [880, 1174.7].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.5);
    });
  }

  function enableSound() {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      void ctx.resume();
      setSoundOn(true);
      // pequeno "clique" de confirmação
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 660;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      /* navegador sem Web Audio — segue sem som */
    }
  }

  // Detecta uma NOVA chamada (mudou o called_at da última senha chamada) → sino + destaque.
  useEffect(() => {
    const key = lastCalled ? `${lastCalled.id}@${lastCalled.calledAt}` : null;
    if (key && key !== lastCalledKeyRef.current) {
      lastCalledKeyRef.current = key;
      setAlert(lastCalled);
      if (soundOn) chime();
      if (alertTimer.current) clearTimeout(alertTimer.current);
      alertTimer.current = setTimeout(() => setAlert(null), 12000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCalled?.id, lastCalled?.calledAt, soundOn]);

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent font-display text-h4 font-black text-text-inverse">
            {name.slice(0, 2).toUpperCase()}
          </span>
          <span className="font-display text-h3 uppercase tracking-wide text-text">{name}</span>
        </div>
        <div className="flex items-center gap-4">
          {doneCount > 0 && (
            <span className="flex items-center gap-1.5 text-body text-text-2">
              <CheckCircle2 size={18} className="text-success-strong" /> {doneCount} atendida{doneCount > 1 ? "s" : ""} hoje
            </span>
          )}
          {!soundOn && (
            <button
              onClick={enableSound}
              className="flex items-center gap-1.5 rounded-pill border border-accent px-3 py-1.5 text-caption font-semibold text-accent hover:bg-accent-wash"
            >
              <Volume2 size={15} /> Ativar som
            </button>
          )}
        </div>
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
                  className={`flex min-w-[120px] flex-col items-center gap-0.5 rounded-xl border px-6 py-4 ${
                    alert && alert.id === w.id ? "border-2 border-accent bg-accent-wash" : "border-border bg-surface"
                  }`}
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

      {/* Banner de chamada (aparece ao clicar em "Chamar" no admin) */}
      {alert && (
        <div className="pointer-events-none fixed inset-0 z-modal flex items-center justify-center bg-black/55 p-6">
          <div className="flex animate-[pulse_1s_ease-in-out_infinite] flex-col items-center gap-4 rounded-3xl border-4 border-accent bg-surface px-16 py-12 text-center shadow-lg">
            <span className="flex items-center gap-2 text-overline uppercase tracking-[0.2em] text-accent">
              <BellRing size={20} /> Chamando
            </span>
            <span className="font-display text-[160px] font-black leading-none text-accent">#{alert.ticket}</span>
            <span className="text-h1 font-bold text-text">{alert.firstName}</span>
            <span className="text-h5 text-text-2">Dirija-se ao balcão, por favor</span>
          </div>
        </div>
      )}
    </div>
  );
}
