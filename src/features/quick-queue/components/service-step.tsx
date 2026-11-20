"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { joinQuickQueue, loadQuickQueueOptions } from "../actions";
import {
  QUICK_QUEUE_IDENTIFY_MESSAGES,
  QUICK_QUEUE_JOIN_MESSAGES as MSG,
  type QuickQueueOptions,
} from "../types";

type Load =
  | { state: "loading" }
  | { state: "error"; error: string }
  | { state: "ready"; options: QuickQueueOptions };

/**
 * Escolha do serviço com preço e entrada na fila (#97).
 * Lista e preço vêm do servidor (loadQuickQueueOptions); a tela manda só o slug e o que foi
 * tocado. Textos só de QUICK_QUEUE_JOIN_MESSAGES / das respostas das ações.
 * - restart (aparelho sem telefone identificado) → onRestart: volta ao telefone com o aviso.
 * - SERVICE_CHANGED → aviso, lista trocada pela devolvida e serviço desmarcado.
 * - ok → onJoined (#98 mostra a senha).
 */
export function ServiceStep({
  slug,
  onRestart,
  onJoined,
}: {
  slug: string;
  onRestart: (error: string) => void;
  onJoined: () => void;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [serviceId, setServiceId] = useState<string | null>(null);
  // null = "Sem preferência" (padrão).
  const [barberId, setBarberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Trava síncrona: dois toques no mesmo instante não criam dois pedidos.
  const inFlight = useRef(false);
  const errorId = useId();

  const restartRef = useRef(onRestart);
  restartRef.current = onRestart;

  const fetchOptions = useCallback(async () => {
    try {
      const res = await loadQuickQueueOptions(slug);
      if (res.ok) setLoad({ state: "ready", options: res.options });
      else if (res.restart) restartRef.current(res.error);
      else setLoad({ state: "error", error: res.error });
    } catch {
      setLoad({ state: "error", error: QUICK_QUEUE_IDENTIFY_MESSAGES.failed });
    }
  }, [slug]);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  /** Troca a lista (SERVICE_CHANGED): o serviço sai; o barbeiro só fica se ainda estiver na lista. */
  function replaceOptions(options: QuickQueueOptions) {
    setLoad({ state: "ready", options });
    setServiceId(null);
    setBarberId((b) => (b && options.pickBarber && options.barbers.some((x) => x.id === b) ? b : null));
  }

  function join() {
    if (load.state !== "ready" || !serviceId || inFlight.current) return;
    const service = load.options.services.find((s) => s.id === serviceId);
    if (!service) return;
    const barber = load.options.pickBarber ? barberId : null;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const res = await joinQuickQueue(slug, { serviceId, priceCents: service.priceCents, barberId: barber });
        if (res.ok) {
          onJoined();
          return;
        }
        if (res.code === "RESTART") {
          onRestart(res.error);
          return;
        }
        if (res.code === "SERVICE_CHANGED") replaceOptions(res.options);
        setError(res.error);
      } catch {
        // Sem conexão: a escolha continua marcada para tentar de novo.
        setError(QUICK_QUEUE_IDENTIFY_MESSAGES.failed);
      } finally {
        inFlight.current = false;
      }
    });
  }

  const title = (
    <h1 className="text-center font-display text-h3 font-black uppercase text-text">{MSG.title}</h1>
  );

  if (load.state === "loading") {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        {title}
        <div className="flex flex-col gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (load.state === "error") {
    return (
      <div className="flex flex-col gap-6">
        {title}
        <p role="alert" className="text-center text-body text-danger">
          {load.error}
        </p>
      </div>
    );
  }

  const { services, pickBarber, barbers } = load.options;

  if (services.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {title}
        <p role="status" className="text-center text-body-lg text-text-2">
          {MSG.noServices}
        </p>
        {error && (
          <p role="alert" className="text-center text-caption text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  const showBarbers = pickBarber && barbers.length > 0;

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        join();
      }}
    >
      {title}

      <fieldset className="flex flex-col gap-2" disabled={pending}>
        <legend className="sr-only">{MSG.title}</legend>
        {services.map((s) => {
          const checked = serviceId === s.id;
          return (
            <label
              key={s.id}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus ${
                checked ? "border-accent bg-accent-wash" : "border-border bg-surface hover:border-text-muted"
              }`}
            >
              <input
                type="radio"
                name="service"
                value={s.id}
                checked={checked}
                onChange={() => {
                  setServiceId(s.id);
                  setError(null);
                }}
                className="sr-only"
              />
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  checked ? "border-accent" : "border-text-muted"
                }`}
              >
                {checked && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0 flex-1 break-words text-body font-semibold text-text">{s.name}</span>
              <span className="shrink-0 text-body font-semibold tabular text-text">{s.priceLabel}</span>
            </label>
          );
        })}
      </fieldset>

      {showBarbers && (
        <fieldset className="flex flex-col gap-2" disabled={pending}>
          <legend className="mb-2 text-caption font-semibold text-text-2">{MSG.barberLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {[{ id: null, name: MSG.noPreference }, ...barbers].map((b) => {
              const checked = barberId === b.id;
              return (
                <label
                  key={b.id ?? "none"}
                  className={`inline-flex min-h-11 max-w-full cursor-pointer items-center rounded-pill border-2 px-4 text-body transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus ${
                    checked ? "border-accent bg-accent-wash font-semibold text-accent" : "border-border text-text-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="barber"
                    value={b.id ?? ""}
                    checked={checked}
                    onChange={() => setBarberId(b.id)}
                    className="sr-only"
                  />
                  <span className="truncate">{b.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-2">
        {error && (
          <p id={errorId} role="alert" className="text-center text-caption text-danger">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={pending}
          disabled={!serviceId}
          aria-describedby={error ? errorId : undefined}
        >
          {MSG.join}
        </Button>
      </div>
    </form>
  );
}
