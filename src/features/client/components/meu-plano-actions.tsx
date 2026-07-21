"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { cancelSubscription } from "@/features/client/actions";

export function MeuPlanoActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 flex gap-3">
      <Link href="/servicos">
        <Button variant="outline" size="sm">
          Trocar plano
        </Button>
      </Link>
      <Button variant="ghost" size="sm" loading={pending} onClick={() => setOpen(true)}>
        Cancelar assinatura
      </Button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancelar assinatura?"
        message="Sua assinatura será encerrada e você deixará de acumular cortes. Você pode assinar novamente quando quiser."
        confirmLabel="Cancelar assinatura"
        danger
        onConfirm={() =>
          startTransition(async () => {
            await cancelSubscription();
            router.refresh();
          })
        }
      />
    </div>
  );
}
