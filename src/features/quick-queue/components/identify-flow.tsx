"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { identifyPhone, registerName } from "../actions";
import { QUICK_QUEUE_IDENTIFY_MESSAGES, type QuickQueueMyTicket } from "../types";
import { PhoneStep } from "./phone-step";
import { NameStep } from "./name-step";
import { ServiceStep } from "./service-step";
import { MyTicket, fetchQuickQueueStatus, isFinalTicket } from "./my-ticket";

type Step = "CHECKING" | "PHONE" | "NAME" | "SERVICE" | "TICKET";

/** Tempo máximo da consulta inicial antes de abrir o telefone (rede lenta não trava a entrada). */
const CHECK_TIMEOUT_MS = 4_000;

/**
 * Jornada telefone → nome → serviço → "Minha senha" da fila rápida (#96, #97, #98).
 * Ao abrir, consulta a senha deste aparelho: com senha ativa vai direto para "Minha senha".
 * Todo mundo passa pelo telefone nesta fase, inclusive cliente logado (um caminho só).
 * O telefone e o nome ficam aqui, fora dos passos: erro, falha de conexão ou volta ao telefone
 * nunca apagam o que o cliente digitou. A tela manda só o slug e o texto digitado; quem é o
 * cliente é decidido no servidor (credencial do aparelho em cookie HttpOnly, gravado pela ação).
 */
export function IdentifyFlow({ slug }: { slug: string }) {
  const [step, setStep] = useState<Step>("CHECKING");
  const [resume, setResume] = useState<QuickQueueMyTicket | null>(null);
  const [justJoined, setJustJoined] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Trava síncrona: dois toques no mesmo instante não disparam dois envios.
  const inFlight = useRef(false);

  // Reabrir o link com senha ativa neste aparelho: direto para "Minha senha", sem digitar nada.
  useEffect(() => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
    let alive = true;
    fetchQuickQueueStatus(slug, ctrl.signal)
      .then((res) => {
        if (!alive) return;
        if (res.ok && res.ticket && !isFinalTicket(res.ticket)) {
          setResume(res.ticket);
          setStep("TICKET");
        } else setStep("PHONE");
      })
      .catch(() => alive && setStep("PHONE"))
      .finally(() => clearTimeout(timeout));
    return () => {
      alive = false;
      clearTimeout(timeout);
      ctrl.abort();
    };
  }, [slug]);

  function run(task: () => Promise<void>, onFail: (msg: string) => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        await task();
      } catch {
        // Sem conexão ou servidor fora: aviso na tela, o que foi digitado continua.
        onFail(QUICK_QUEUE_IDENTIFY_MESSAGES.failed);
      } finally {
        inFlight.current = false;
      }
    });
  }

  function submitPhone(digits: string) {
    run(async () => {
      const res = await identifyPhone(slug, digits);
      if (!res.ok) {
        if (res.field === "name") {
          setNameError(res.error);
          setStep("NAME");
        } else setPhoneError(res.error);
        return;
      }
      setStep(res.next);
    }, setPhoneError);
  }

  function submitName(value: string) {
    run(async () => {
      const res = await registerName(slug, value);
      if (!res.ok) {
        if (res.restart) {
          setPhoneError(res.error);
          setStep("PHONE");
        } else setNameError(res.error);
        return;
      }
      setStep("SERVICE");
    }, setNameError);
  }

  if (step === "NAME") {
    return (
      <NameStep
        value={name}
        onChange={setName}
        error={nameError}
        onErrorChange={setNameError}
        pending={pending}
        onContinue={submitName}
        onBack={() => {
          setNameError(null);
          setStep("PHONE");
        }}
      />
    );
  }

  if (step === "SERVICE") {
    return (
      <ServiceStep
        slug={slug}
        onRestart={(error) => {
          setPhoneError(error);
          setStep("PHONE");
        }}
        onJoined={() => {
          setResume(null);
          setJustJoined(true);
          setStep("TICKET");
        }}
      />
    );
  }

  if (step === "TICKET") {
    return (
      <MyTicket
        slug={slug}
        initial={resume}
        justJoined={justJoined}
        onNoTicket={() => {
          setResume(null);
          setStep("PHONE");
        }}
        onLeft={() => {
          setResume(null);
          setJustJoined(false);
          setStep("PHONE");
        }}
        onNewTicket={() => {
          // O aparelho já está identificado; se não estiver mais, a escolha volta ao telefone.
          setResume(null);
          setJustJoined(false);
          setStep("SERVICE");
        }}
      />
    );
  }

  if (step === "CHECKING") {
    return <div aria-busy="true" className="my-auto h-40 animate-pulse rounded-xl border border-border bg-surface" />;
  }

  return (
    <PhoneStep
      value={phone}
      onChange={setPhone}
      error={phoneError}
      onErrorChange={setPhoneError}
      pending={pending}
      onContinue={submitPhone}
    />
  );
}
