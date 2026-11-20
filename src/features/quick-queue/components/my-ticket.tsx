"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { leaveQuickQueue } from "../actions";
import {
  QUICK_QUEUE_JOIN_MESSAGES,
  QUICK_QUEUE_MESSAGES,
  QUICK_QUEUE_STATUS_POLL as POLL,
  QUICK_QUEUE_TICKET_MESSAGES as MSG,
  type QuickQueueMyTicket,
  type QuickQueueStatusResponse,
  type QuickQueueTicketState,
} from "../types";

/** Espera depois de LIMIT (a rota aceita 1 consulta a cada 2 s por aparelho). */
const LIMIT_WAIT_MS = 2_000;

const FINAL: QuickQueueTicketState[] = ["DONE", "SKIPPED", "CANCELLED"];

export function isFinalTicket(t: QuickQueueMyTicket) {
  return FINAL.includes(t.state);
}

/** Lê a senha deste aparelho. Falha de rede vira GENERIC (= sem conexão). */
export async function fetchQuickQueueStatus(slug: string, signal?: AbortSignal): Promise<QuickQueueStatusResponse> {
  try {
    const res = await fetch(`/b/${encodeURIComponent(slug)}/fila/rapida/status`, {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
    if (res.status === 429) return { ok: false, code: "LIMIT" };
    const body = (await res.json()) as QuickQueueStatusResponse;
    return body && typeof body.ok === "boolean" ? body : { ok: false, code: "GENERIC" };
  } catch (e) {
    if (signal?.aborted) throw e;
    return { ok: false, code: "GENERIC" };
  }
}

/**
 * Tela "Minha senha" (#98). A senha vem só da consulta GET /b/<slug>/fila/rapida/status, que
 * reconhece o aparelho pelo cookie; a tela não guarda nem manda número de senha.
 * Consulta a cada POLL.everyMs com a aba visível e pausa em segundo plano (volta na hora ao
 * reaparecer). Sem conexão: aviso e recuo 5/10/20/30 s. LIMIT (1 consulta a cada 2 s por
 * aparelho, comum logo depois de entrar): espera LIMIT_WAIT_MS e consulta de novo, sem aviso.
 * Estados: SKIPPED = pulada ou removida pela barbearia; CANCELLED = o cliente saiu pela tela.
 * Depois de "Sair da fila" com sucesso, a tela já mostra CANCELLED, sem esperar a consulta.
 * A tela nunca volta sozinha para o início: só sem senha (ticket null) ou no "Pegar nova senha".
 */
function MyTicketBody({
  slug,
  initial,
  onNoTicket,
  onNewTicket,
}: {
  slug: string;
  /** Senha já lida (reabrir o link); sem ela, a tela começa consultando. */
  initial?: QuickQueueMyTicket | null;
  onNoTicket: () => void;
  onNewTicket: () => void;
}) {
  const [ticket, setTicket] = useState<QuickQueueMyTicket | null>(initial ?? null);
  const [offline, setOffline] = useState(false);
  const [closed, setClosed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const failures = useRef(0);
  const noTicketRef = useRef(onNoTicket);
  noTicketRef.current = onNoTicket;

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    abort.current?.abort();
    abort.current = null;
  }, []);

  const poll = useCallback(async () => {
    stop();
    if (document.visibilityState === "hidden") return; // volta no visibilitychange
    const ctrl = new AbortController();
    abort.current = ctrl;
    let res: QuickQueueStatusResponse;
    try {
      res = await fetchQuickQueueStatus(slug, ctrl.signal);
    } catch {
      return; // cancelada (aba oculta, nova consulta ou saída da tela)
    }
    if (ctrl.signal.aborted) return;
    abort.current = null;

    let wait: number = POLL.everyMs;
    if (res.ok) {
      failures.current = 0;
      setOffline(false);
      setClosed(false);
      if (!res.ticket) {
        noTicketRef.current();
        return;
      }
      setTicket(res.ticket);
      if (isFinalTicket(res.ticket)) return; // estado final: nada mais muda
    } else if (res.code === "CLOSED") {
      failures.current = 0;
      setOffline(false);
      setClosed(true);
    } else if (res.code === "LIMIT") {
      wait = LIMIT_WAIT_MS; // sem aviso e sem contar como falha de conexão
    } else {
      const i = Math.min(failures.current, POLL.backoffMs.length - 1);
      failures.current += 1;
      wait = POLL.backoffMs[i];
      setOffline(true);
    }
    timer.current = setTimeout(() => void poll(), wait);
  }, [slug, stop]);

  useEffect(() => {
    if (initial && isFinalTicket(initial)) return;
    void poll();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [poll, stop, initial]);

  function leave() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLeaveError(null);
    startTransition(async () => {
      try {
        const res = await leaveQuickQueue(slug);
        if (res.ok) {
          // Saiu: estado final na hora (CANCELLED = saída pela tela); a consulta não precisa voltar.
          stop();
          setConfirming(false);
          setOffline(false);
          setTicket((t) => (t ? { ...t, state: "CANCELLED", ahead: 0 } : t));
          return;
        }
        if (res.code === "NOT_WAITING") {
          // Já foi chamada ou atendida: a consulta mostra o estado certo.
          setConfirming(false);
          void poll();
          return;
        }
        setLeaveError(res.error);
      } catch {
        setLeaveError(MSG.failed);
      } finally {
        inFlight.current = false;
      }
    });
  }


  if (!ticket) {
    return (
      <div className="flex flex-col items-center gap-6" aria-busy="true">
        <h1 className="font-display text-h3 font-black uppercase text-text">{MSG.title}</h1>
        <div aria-hidden className="h-32 w-48 animate-pulse rounded-xl border border-border bg-surface" />
        {offline && <p className="text-caption text-text-2">{MSG.offline}</p>}
      </div>
    );
  }

  const final = isFinalTicket(ticket);
  const called = ticket.state === "CALLED";
  const waiting = ticket.state === "WAITING" || ticket.state === "NEXT";
  const finalText =
    ticket.state === "DONE" ? MSG.done : ticket.state === "SKIPPED" ? MSG.skipped : ticket.state === "CANCELLED" ? MSG.cancelled : null;

  return (
    <div className="flex flex-col gap-6">
      <div
        className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-4 py-8 text-center ${
          called ? "border-accent bg-accent-wash" : "border-border bg-surface"
        }`}
      >
        <h1 className="text-caption font-semibold uppercase tracking-wider text-text-2">{MSG.title}</h1>
        <p
          className={`font-display text-[88px] font-black leading-none tabular ${final ? "text-text-muted" : "text-accent"}`}
        >
          {ticket.number}
        </p>

        {/* Mudanças da fila anunciadas no leitor de tela sem roubar o foco. */}
        <div role="status" aria-live="polite" className="mt-3 flex flex-col items-center gap-1">
          {called && <p className="font-display text-h3 font-black uppercase text-accent">{MSG.called}</p>}
          {ticket.state === "NEXT" && <p className="text-body-lg font-semibold text-text">{MSG.next}</p>}
          {ticket.state === "WAITING" && (
            <p className="text-body-lg font-semibold text-text">{MSG.ahead.replace("{n}", String(ticket.ahead))}</p>
          )}
          {finalText && <p className="max-w-[300px] text-body-lg font-semibold text-text">{finalText}</p>}
        </div>

        {waiting && ticket.nowServing !== null && (
          <p className="mt-1 text-body text-text-2 tabular">
            {MSG.nowServing.replace("{senha}", String(ticket.nowServing))}
          </p>
        )}
      </div>

      {(offline || closed) && (
        <p role="status" className="text-center text-caption text-text-2">
          {closed ? QUICK_QUEUE_MESSAGES.unavailable : MSG.offline}
        </p>
      )}

      {final && (
        <Button type="button" size="lg" className="w-full" onClick={onNewTicket}>
          {MSG.newTicket}
        </Button>
      )}

      {waiting && !confirming && (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="w-full"
          onClick={() => {
            setLeaveError(null);
            setConfirming(true);
          }}
        >
          {MSG.leave}
        </Button>
      )}

      {waiting && confirming && (
        <div role="group" aria-labelledby="sair-da-fila" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p id="sair-da-fila" className="text-center text-body font-semibold text-text">
            {MSG.leaveConfirm}
          </p>
          {leaveError && (
            <p role="alert" className="text-center text-caption text-danger">
              {leaveError}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button type="button" variant="danger" size="lg" className="w-full" loading={pending} onClick={leave}>
              {MSG.leaveYes}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                setLeaveError(null);
              }}
              autoFocus
            >
              {MSG.leaveNo}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * "Minha senha" + aviso de entrada. A região aria-live fica fora do corpo para continuar montada
 * quando a tela troca de "consultando" para a senha: ela monta vazia e só depois recebe
 * "Você entrou na fila." (com o texto já na montagem, alguns leitores de tela não anunciam).
 */
export function MyTicket({
  justJoined = false,
  ...props
}: Parameters<typeof MyTicketBody>[0] & {
  /** Acabou de entrar: anuncia QUICK_QUEUE_JOIN_MESSAGES.joined no leitor de tela. */
  justJoined?: boolean;
}) {
  const [announce, setAnnounce] = useState(false);
  useEffect(() => {
    if (!justJoined) return;
    const t = setTimeout(() => setAnnounce(true), 300);
    return () => clearTimeout(t);
  }, [justJoined]);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {announce ? QUICK_QUEUE_JOIN_MESSAGES.joined : ""}
      </div>
      <MyTicketBody {...props} />
    </>
  );
}
