"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { requestPasswordReset } from "../password-reset";
import { CONTACT_SCREEN_COPY as COPY } from "../contact-screen-copy";

/** Passo 1 da recuperação: informar o e-mail ou telefone e receber o link. */
export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(COPY.failed);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg">
        <div className="flex items-start gap-2.5 rounded-md border border-accent bg-accent-wash px-3.5 py-3">
          <MailCheck size={18} className="mt-0.5 shrink-0 text-accent" />
          <div className="text-caption text-text-2">
            <p className="font-semibold text-text">Pedido recebido</p>
            <p className="mt-0.5">
              {COPY.resetSent}
            </p>
            <p className="mt-2">{COPY.resetNoEmail}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSent(false)}>
          {COPY.resetAgain}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSend}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="recuperar-id">{COPY.resetLabel}</Label>
        <Input
          id="recuperar-id"
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com ou (11) 91234-5678"
          autoComplete="username"
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={loading}>
        Enviar link
      </Button>
    </form>
  );
}
