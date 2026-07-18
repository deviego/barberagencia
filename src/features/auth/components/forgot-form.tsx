"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "./password-input";
import { sendPasswordReset, updatePassword } from "../services/auth-service";
import { cn } from "@/lib/utils";

const STRENGTH_LABEL = ["—", "fraca", "boa", "forte"];
function pwStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export function ForgotForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
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

  async function onSave() {
    setError(null);
    if (pw.length < 8 || pw !== pw2) {
      setError("As senhas devem coincidir e ter ao menos 8 caracteres.");
      return;
    }
    try {
      await updatePassword(pw);
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar senha");
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg">
      <form onSubmit={onSend} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>E-mail cadastrado</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="william@email.com"
          />
        </div>
        <Button type="submit" size="lg" loading={loading}>
          Enviar link
        </Button>
      </form>

      {sent && (
        <div className="flex items-center gap-2.5 rounded-md border border-accent bg-accent-wash px-3.5 py-3">
          <MailCheck size={16} className="text-accent" />
          <span className="text-caption">Link enviado. Confira sua caixa de entrada e o spam.</span>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
        <div className="text-overline uppercase text-text-muted">Nova senha (após o link)</div>
        <PasswordInput
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Nova senha"
        />
        <PasswordInput
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="Confirmar nova senha"
        />
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full",
                i < pwStrength(pw) ? "bg-success" : "bg-n700"
              )}
            />
          ))}
          <span className="text-[11px] text-text-muted">
            força: {STRENGTH_LABEL[pwStrength(pw)]}
          </span>
        </div>
        {error && <p className="text-caption text-danger">{error}</p>}
        <Button type="button" variant="outline" onClick={onSave}>
          Salvar nova senha
        </Button>
      </div>
    </div>
  );
}
