"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/nav/logout-button";
import { completeInviteAcceptance } from "@/features/auth/invite-actions";
import { CONTACT_SCREEN_COPY as COPY } from "@/features/auth/contact-screen-copy";

/**
 * "Concluir convite" (#177): conta criada pelo convite, mas ainda sem vínculo com a barbearia.
 * Roda numa página dentro de /client para a ação enxergar a sessão do cliente.
 * `autoStart`: vindo direto do cadastro, conclui na hora; o botão fica para tentar de novo.
 */
export function CompleteInvite({
  token,
  shopName,
  autoStart,
}: {
  token: string;
  shopName: string;
  autoStart: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "invalid" | "error">(
    autoStart ? "loading" : "idle"
  );
  const started = useRef(false);

  async function run() {
    setState("loading");
    try {
      const res = await completeInviteAcceptance(token);
      if (res.ok) {
        setState("done");
        router.replace("/client");
        router.refresh();
        return;
      }
      if (res.code === "NOT_SIGNED_IN") {
        router.replace("/client/login");
        return;
      }
      setState(res.code === "INVALID_INVITE" ? "invalid" : "error");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  if (state === "done") {
    return (
      <p role="status" className="flex items-center justify-center gap-2 text-body text-success-strong">
        <CheckCircle2 size={18} aria-hidden="true" />
        {COPY.inviteDone}
      </p>
    );
  }

  if (state === "invalid") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p role="alert" className="text-body text-text-2">
          {COPY.inviteInvalid}
        </p>
        <LogoutButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-body text-text-2">{COPY.inviteStep(shopName)}</p>
      {state === "error" && (
        <p role="alert" className="text-center text-caption text-danger">
          {COPY.failed}
        </p>
      )}
      <Button size="lg" loading={state === "loading"} onClick={() => void run()}>
        {COPY.inviteButton}
      </Button>
    </div>
  );
}
