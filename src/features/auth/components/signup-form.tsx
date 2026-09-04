"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "./password-input";
import { TermsModal } from "./terms-modal";
import { signInWithPassword } from "../services/auth-service";
import { registerClientAccount, sendWelcomeEmail } from "@/features/auth/actions";
import { maskDate, maskPhoneBR } from "@/lib/masks";

export function SignupForm({
  tenantSubdomain,
}: {
  tenantName?: string;
  tenantSubdomain?: string;
}) {
  const router = useRouter();
  const [termsOpen, setTermsOpen] = useState(false);
  const [form, setForm] = useState({ name: "", birth: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onAccept() {
    setTermsOpen(false); // fecha o modal ao aceitar — erros aparecem no formulário, não atrás dele
    setError(null);
    setLoading(true);
    try {
      const res = await registerClientAccount({
        name: form.name,
        phone: form.phone,
        password: form.password,
        email: form.email || undefined,
        tenantSubdomain,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Conta já confirmada — entra direto (login pelo e-mail técnico ou real).
      await signInWithPassword(res.authEmail, form.password);
      await sendWelcomeEmail().catch(() => {});
      router.push("/client");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (form.phone.replace(/\D/g, "").length < 10) {
            setError("Informe um telefone válido com DDD.");
            return;
          }
          if (form.password.length < 8) {
            setError("A senha deve ter ao menos 8 caracteres.");
            return;
          }
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
              placeholder="(11) 91234-5678"
              inputMode="tel"
              maxLength={15}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>E-mail (opcional)</Label>
          <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" placeholder="william@email.com" />
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
          <Link href="/client/login" className="font-semibold text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </form>

      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} onAccept={onAccept} />
    </>
  );
}
