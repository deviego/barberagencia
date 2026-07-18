import Link from "next/link";
import { Check, Facebook, Instagram, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CURRENT_CLIENT } from "@/features/client/mock-data";

export default function BoasVindasPage() {
  const c = CURRENT_CLIENT;
  return (
    <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-lg border border-border bg-surface p-8 text-center">
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{
          background:
            "repeating-linear-gradient(-45deg, var(--bb-pole-red) 0 12px, var(--bb-pole-white) 12px 24px, var(--bb-pole-blue) 24px 36px)",
        }}
      />
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg">
        <Check size={32} className="text-success-strong" strokeWidth={3} />
      </div>
      <h1 className="font-display text-h1 uppercase leading-none text-text">
        Bem-vindo, {c.name}!
      </h1>
      <p className="max-w-md text-body text-text-2">
        Sua inscrição foi concluída. Muito obrigado por escolher nossos serviços — siga as redes
        sociais da barbearia e fique por dentro de tudo.
      </p>
      <div className="flex gap-4 text-text-2">
        <Instagram size={22} />
        <Facebook size={22} />
        <Send size={22} />
      </div>
      <Link href="/" className="w-full max-w-xs">
        <Button size="lg" className="w-full">
          Ir para o início
        </Button>
      </Link>
    </div>
  );
}
