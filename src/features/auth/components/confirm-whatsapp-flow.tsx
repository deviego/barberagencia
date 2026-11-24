"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "./password-input";
import { createClientAreaBrowserClient } from "@/lib/supabase/client";
import { maskPhoneBR } from "@/lib/masks";
import type {
  ConfirmWhatsappInput,
  ConfirmWhatsappResult,
  ProveAccountAndLinkInput,
  ProveAccountAndLinkResult,
} from "@/features/auth/google-types";

/**
 * Fluxo de quem entrou com Google e ainda não tem cadastro de cliente (ADR 0005, itens 3 a 5):
 * 1. "Confirme seu WhatsApp": informa o telefone.
 * 2. Telefone que já tem conta: prova de posse pela SENHA da conta (fase 1) e depois liga o Google.
 * O telefone fica só na memória da tela (nunca na URL).
 */
export function ConfirmWhatsappFlow({
  shopName,
  firstName,
  confirmWhatsapp,
  proveAccountAndLink,
}: {
  shopName: string;
  firstName: string | null;
  confirmWhatsapp: (input: ConfirmWhatsappInput) => Promise<ConfirmWhatsappResult>;
  proveAccountAndLink: (input: ProveAccountAndLinkInput) => Promise<ProveAccountAndLinkResult>;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "proof">("phone");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneInvalid, setPhoneInvalid] = useState(false);

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhoneInvalid(false);
    if (phone.replace(/\D/g, "").length < 10) {
      setPhoneInvalid(true);
      setError("Digite seu WhatsApp com DDD.");
      return;
    }
    setLoading(true);
    try {
      const res = await confirmWhatsapp({ phone });
      if (res.ok) {
        router.replace(res.next);
        router.refresh();
        return;
      }
      if (res.code === "NEEDS_PROOF") {
        setStep("proof");
        return;
      }
      if (res.code === "NOT_SIGNED_IN") {
        router.replace("/client/login");
        return;
      }
      setPhoneInvalid(res.code === "INVALID_PHONE");
      setError(res.error);
    } catch {
      setError("Não deu para confirmar agora. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  async function onProve(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Digite a senha da sua conta.");
      return;
    }
    setLoading(true);
    try {
      const res = await proveAccountAndLink({ phone, password });
      if (!res.ok) {
        if (res.code === "NOT_SIGNED_IN") {
          router.replace("/client/login");
          return;
        }
        setError(res.error);
        setLoading(false);
        return;
      }
      // Posse provada: a sessão já é da conta existente. O Google é ligado pelo navegador.
      const supabase = createClientAreaBrowserClient();
      const redirectTo = `${window.location.origin}/client/auth/callback?next=${encodeURIComponent("/client")}`;
      const { error: linkErr } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } });
      if (linkErr) {
        // A conta já está acessível com a senha; só o Google não foi ligado.
        router.replace("/client/perfil");
        router.refresh();
      }
      // Sem erro, o navegador já está indo para o Google: mantém o carregando.
    } catch {
      setError("Não deu para confirmar agora. Tente de novo.");
      setLoading(false);
    }
  }

  if (step === "proof") {
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <h1 className="font-display text-h2 uppercase leading-none text-text">Esse número já tem conta</h1>
          <p className="mt-2 text-body text-text-2">
            Para juntar com o seu Google, digite a senha que você já usa para entrar com esse número.
          </p>
        </div>
        <form
          onSubmit={onProve}
          className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 rounded-md bg-inset px-3 py-2.5">
            <div>
              <div className="text-caption text-text-muted">WhatsApp</div>
              <div className="text-body font-semibold text-text">{phone}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setPassword("");
                setError(null);
              }}
              className="min-h-11 px-2 text-caption font-semibold text-accent hover:underline"
            >
              Trocar número
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prova-senha">Senha da conta</Label>
            <PasswordInput
              id="prova-senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>

          {error && (
            <p role="alert" className="text-caption text-danger">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" loading={loading}>
            Juntar contas
          </Button>

          <p className="flex items-start gap-2 rounded-md bg-accent-wash px-3 py-2.5 text-caption text-text-2">
            <MessageCircle size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <span>
              Não lembra a senha? Se você cadastrou um e-mail, use &quot;Esqueci minha senha&quot; na tela de
              entrar. Se cadastrou só o telefone, fale com a {shopName}. Sem a senha, não dá para juntar as
              contas.
            </span>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="font-display text-h2 uppercase leading-none text-text">Confirme seu WhatsApp</h1>
        <p className="mt-2 text-body text-text-2">
          {firstName ? `Falta pouco, ${firstName}. ` : "Falta pouco. "}A {shopName} usa seu WhatsApp para
          falar com você sobre seus horários.
        </p>
      </div>
      <form
        onSubmit={onConfirm}
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmar-whatsapp">WhatsApp com DDD</Label>
          <Input
            id="confirmar-whatsapp"
            value={phone}
            onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
            placeholder="(11) 91234-5678"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={15}
            error={phoneInvalid}
            aria-invalid={phoneInvalid || undefined}
            autoFocus
            required
          />
        </div>

        {error && (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={loading}>
          Continuar
        </Button>
      </form>
    </div>
  );
}
