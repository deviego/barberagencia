"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { confirmPasswordReset } from "@/features/auth/actions";

/** Passo intermediário da recuperação por WhatsApp: valida o link e abre a sessão. */
export function ConfirmResetForm({ tokenHash }: { tokenHash: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(tokenHash ? null : "Link inválido.");

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await confirmPasswordReset(tokenHash);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 text-center shadow-lg">
      {error ? (
        <>
          <p className="text-body text-text-2">{error}</p>
          <Link href="/client/recuperar-senha">
            <Button className="w-full">Pedir novo link</Button>
          </Link>
        </>
      ) : (
        <Button size="lg" loading={pending} onClick={onConfirm}>
          Criar nova senha
        </Button>
      )}
    </div>
  );
}
