"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "./password-input";
import { signUpWithPassword } from "../services/auth-service";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AcceptInviteForm({ token, email, name }: { token: string; email: string; name: string }) {
  const router = useRouter();
  const [mail, setMail] = useState(email);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const data = await signUpWithPassword(mail, pw, { full_name: name });
      const supabase = createSupabaseBrowserClient();
      await supabase.rpc("accept_invite", { p_token: token });
      if (data.session) router.push("/");
      else setConfirm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar acesso");
    } finally {
      setLoading(false);
    }
  }

  if (confirm) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash">
          <MailCheck size={24} className="text-accent" />
        </span>
        <p className="text-body text-text-2">
          Acesso criado! Confirme seu e-mail (<strong className="text-text">{mail}</strong>) para entrar.
        </p>
        <Link href="/login" className="text-body font-semibold text-accent hover:underline">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>E-mail</Label>
        <Input type="email" value={mail} onChange={(e) => setMail(e.target.value)} required />
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
