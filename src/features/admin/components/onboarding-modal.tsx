"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Modal de boas-vindas no primeiro acesso — leva o admin para as configurações iniciais. */
export function OnboardingModal({ show, barbershop }: { show: boolean; barbershop: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(show);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-6" onClick={() => setOpen(false)}>
      <div
        className="w-[440px] max-w-full rounded-lg border border-border bg-elevated p-7 text-center shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent">
          <Sparkles size={28} />
        </span>
        <h2 className="text-h3 font-bold text-text">Bem-vindo{barbershop ? `, ${barbershop}` : ""}! 🎉</h2>
        <p className="mt-2 text-body text-text-2">
          Vamos deixar sua barbearia pronta. Em poucos minutos você configura <strong>telefone</strong>,
          <strong> horários</strong>, <strong>logo/cor</strong> e conecta o <strong>WhatsApp</strong>.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => router.push("/admin/config")}>
            <Settings size={16} /> Configurar minha barbearia
          </Button>
          <button onClick={() => setOpen(false)} className="text-caption text-text-muted transition-colors hover:text-text">
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
