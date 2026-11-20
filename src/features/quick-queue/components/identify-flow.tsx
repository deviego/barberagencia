"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { identifyPhone, registerName } from "../actions";
import { QUICK_QUEUE_IDENTIFY_MESSAGES } from "../types";
import { PhoneStep } from "./phone-step";
import { NameStep } from "./name-step";

type Step = "PHONE" | "NAME" | "SERVICE";

/**
 * Jornada telefone → nome → serviço da fila rápida (#96).
 * O telefone e o nome ficam aqui, fora dos passos: erro, falha de conexão ou volta ao telefone
 * nunca apagam o que o cliente digitou. A tela manda só o slug e o texto digitado; quem é o
 * cliente é decidido no servidor (credencial do aparelho em cookie HttpOnly, gravado pela ação).
 */
export function IdentifyFlow({ slug }: { slug: string }) {
  const [step, setStep] = useState<Step>("PHONE");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [known, setKnown] = useState(false);
  const [pending, startTransition] = useTransition();
  // Trava síncrona: dois toques no mesmo instante não disparam dois envios.
  const inFlight = useRef(false);

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
      setKnown(res.next === "SERVICE");
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
      setKnown(false);
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
    // TODO(#97): aqui entra a escolha do serviço. Até lá, a tela diz o que fazer e não promete nada.
    return (
      <div role="status" className="my-auto flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </span>
        <p className="max-w-[300px] text-body-lg font-semibold text-text">
          {known ? "Já te conhecemos. Bora escolher o serviço." : "Pronto, cadastro feito. Bora escolher o serviço."}
        </p>
        <p className="max-w-[300px] text-body text-text-2">
          A escolha do serviço ainda não está disponível aqui. Fale com a equipe no balcão.
        </p>
      </div>
    );
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
