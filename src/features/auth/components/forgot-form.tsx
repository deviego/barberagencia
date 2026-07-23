"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { sendPasswordReset } from "../services/auth-service";

/** Passo 1 da recuperação: informar o e-mail e receber o link. */
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
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar");
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
            <p className="font-semibold text-text">Link enviado!</p>
            <p className="mt-0.5">
              Enviamos um link para <span className="font-semibold">{email}</span>. Abra o e-mail
              (confira também o spam) e clique no link para definir uma nova senha.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSent(false)}>
          Enviar para outro e-mail
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
        <Label>E-mail cadastrado</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="william@email.com"
          autoComplete="email"
        />
      </div>
      {error && <p className="text-caption text-danger">{error}</p>}
      <Button type="submit" size="lg" loading={loading}>
        Enviar link
      </Button>
    </form>
  );
}
