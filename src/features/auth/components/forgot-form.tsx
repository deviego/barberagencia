"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, MessageCircle, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { maskPhoneBR } from "@/lib/masks";
import { requestPasswordResetByPhone } from "@/features/auth/actions";

/** Passo 1 da recuperação: informar o telefone e receber o link no WhatsApp. */
export function ForgotForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<{ channel: "whatsapp" | "email"; maskedPhone: string } | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signupHref = `/client/cadastro?phone=${phone.replace(/\D/g, "")}`;

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotRegistered(false);
    setLoading(true);
    try {
      const res = await requestPasswordResetByPhone(phone);
      if (res.ok) setSent({ channel: res.channel, maskedPhone: res.maskedPhone });
      else if (res.notRegistered) {
        setNotRegistered(true);
        setTimeout(() => router.push(signupHref), 2500);
      } else setError(res.error);
    } catch {
      setError("Falha ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg">
        <div className="flex items-start gap-2.5 rounded-md border border-accent bg-accent-wash px-3.5 py-3">
          {sent.channel === "whatsapp" ? (
            <MessageCircle size={18} className="mt-0.5 shrink-0 text-accent" />
          ) : (
            <MailCheck size={18} className="mt-0.5 shrink-0 text-accent" />
          )}
          <div className="text-caption text-text-2">
            <p className="font-semibold text-text">Link enviado!</p>
            <p className="mt-0.5">
              {sent.channel === "whatsapp" ? (
                <>
                  Enviamos um link para o WhatsApp <span className="font-semibold">{sent.maskedPhone}</span>. Abra a
                  mensagem e toque no link para criar uma nova senha.
                </>
              ) : (
                <>Não conseguimos enviar pelo WhatsApp, então enviamos o link para o seu e-mail (confira também o spam).</>
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSent(null)}>
          Enviar novamente
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSend} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg">
      <div className="flex flex-col gap-1.5">
        <Label>Telefone cadastrado</Label>
        <Input
          value={phone}
          onChange={(e) => {
            setPhone(maskPhoneBR(e.target.value));
            setNotRegistered(false);
          }}
          inputMode="tel"
          maxLength={15}
          placeholder="(11) 91234-5678"
          autoComplete="tel"
        />
      </div>
      {notRegistered && (
        <div className="flex items-start gap-2.5 rounded-md border border-danger bg-danger-bg px-3.5 py-3 text-caption text-danger-strong">
          <UserX size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Este telefone não possui cadastro.</p>
            <p className="mt-0.5">Vamos te levar para criar sua conta…</p>
          </div>
        </div>
      )}
      {error && <p className="text-caption text-danger">{error}</p>}
      {notRegistered ? (
        <Button type="button" size="lg" onClick={() => router.push(signupHref)}>
          Criar conta agora
        </Button>
      ) : (
        <Button type="submit" size="lg" loading={loading}>
          Enviar link pelo WhatsApp
        </Button>
      )}
    </form>
  );
}
