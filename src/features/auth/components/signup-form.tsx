"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MailCheck, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "./password-input";
import { TermsModal } from "./terms-modal";
import { signUpWithPassword } from "../services/auth-service";
import { maskDate, maskPhoneBR } from "@/lib/masks";

export function SignupForm({ tenantName = "nossa barbearia" }: { tenantName?: string }) {
  const router = useRouter();
  const [termsOpen, setTermsOpen] = useState(false);
  const [form, setForm] = useState({ name: "", birth: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentConfirm, setSentConfirm] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onAccept() {
    setError(null);
    if (form.password.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const data = await signUpWithPassword(form.email, form.password, {
        full_name: form.name,
        phone: form.phone,
      });
      if (data.session) {
        router.push("/");
      } else {
        setSentConfirm(true); // confirmação de e-mail ativa
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  if (sentConfirm) {
    const firstName = form.name.trim().split(" ")[0];
    return (
      <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-lg border border-border bg-surface p-8 text-center shadow-lg">
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background:
              "repeating-linear-gradient(-45deg, var(--bb-pole-red) 0 12px, var(--bb-pole-white) 12px 24px, var(--bb-pole-blue) 24px 36px)",
          }}
        />
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-wash">
          <Scissors size={28} className="text-accent" />
        </span>
        <h2 className="font-display text-h2 uppercase leading-none text-text">
          Bem-vindo{firstName ? `, ${firstName}` : ""}!
        </h2>
        <p className="max-w-sm text-body text-text-2">
          Que bom ter você na <strong className="text-text">{tenantName}</strong>. Falta só um passo:
          enviamos um link de confirmação para{" "}
          <strong className="text-text">{form.email}</strong>. Confirme para ativar sua conta e já
          agendar seu primeiro corte. ✂️
        </p>
        <div className="flex items-center gap-2 rounded-md bg-inset px-3 py-2 text-caption text-text-muted">
          <MailCheck size={15} className="text-accent" />
          Não recebeu? Verifique o spam ou aguarde alguns instantes.
        </div>
        <Link href="/login" className="text-body font-semibold text-accent hover:underline">
          Já confirmei — ir para o login
        </Link>
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setTermsOpen(true);
        }}
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg"
      >
        <div className="flex flex-col gap-1.5">
          <Label>Nome completo</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="William Santos de Oliveira" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Nascimento</Label>
            <Input
              value={form.birth}
              onChange={(e) => set("birth", maskDate(e.target.value))}
              placeholder="DD/MM/AAAA"
              inputMode="numeric"
              maxLength={10}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Telefone</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", maskPhoneBR(e.target.value))}
              placeholder="+55 (11) 91234-5678"
              inputMode="tel"
              maxLength={19}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>E-mail</Label>
          <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" placeholder="william@email.com" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Senha</Label>
          <PasswordInput value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" required />
        </div>

        {error && <p className="text-caption text-danger">{error}</p>}

        <Button type="submit" size="lg" loading={loading}>
          Criar conta
        </Button>

        <p className="text-center text-body text-text-2">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </form>

      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} onAccept={onAccept} />
    </>
  );
}
