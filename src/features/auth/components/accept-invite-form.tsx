"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "./password-input";
import { signInWithPassword } from "../services/auth-service";
import { registerClientAccount, sendWelcomeEmail } from "@/features/auth/actions";
import { CONTACT_SCREEN_COPY as COPY } from "@/features/auth/contact-screen-copy";
import { maskPhoneBR } from "@/lib/masks";

export function AcceptInviteForm({
  token,
  email,
  name,
  phone,
  tenantSubdomain,
}: {
  token: string;
  email: string;
  name: string;
  phone: string;
  tenantSubdomain?: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(name);
  const [mail, setMail] = useState(email);
  const [tel, setTel] = useState(phone);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (tel.replace(/\D/g, "").length < 10) {
      setError(COPY.invitePhone);
      return;
    }
    if (pw.length < 8) {
      setError(COPY.invitePassword);
      return;
    }
    setLoading(true);
    try {
      const res = await registerClientAccount({
        name: fullName,
        phone: tel,
        password: pw,
        email: mail || undefined,
        tenantSubdomain,
        inviteToken: token,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await signInWithPassword(res.authEmail, pw);
      await sendWelcomeEmail().catch(() => {});
      // Conta criada, mas o convite não ligou no cadastro: conclui numa página dentro de /client,
      // onde a sessão do cliente chega ao servidor (aqui em /convite ela não chega).
      router.push(
        res.pendingInvite ? `/client/concluir-convite/${encodeURIComponent(token)}?auto=1` : "/client"
      );
    } catch (err) {
      setError(COPY.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Nome completo</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Telefone</Label>
        <Input
          value={tel}
          onChange={(e) => setTel(maskPhoneBR(e.target.value))}
          inputMode="tel"
          maxLength={15}
          placeholder="(11) 91234-5678"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>E-mail (opcional)</Label>
        <Input type="email" value={mail} onChange={(e) => setMail(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Crie sua senha</Label>
        <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
      </div>
      {error && <p className="text-caption text-danger">{error}</p>}
      <Button type="submit" size="lg" loading={loading}>
        Criar meu acesso
      </Button>
    </form>
  );
}
