"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "./password-input";
import { TermsModal } from "./terms-modal";
import { signUpWithPassword } from "../services/auth-service";

export function SignupForm() {
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
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-7 text-center shadow-lg">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash">
          <MailCheck size={26} className="text-accent" />
        </span>
        <h2 className="text-h4 font-semibold text-text">Confirme seu e-mail</h2>
        <p className="text-body text-text-2">
          Enviamos um link de confirmação para <strong className="text-text">{form.email}</strong>.
          Confirme para acessar sua conta.
        </p>
        <Link href="/login" className="text-body font-semibold text-accent hover:underline">
          Voltar ao login
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
            <Input value={form.birth} onChange={(e) => set("birth", e.target.value)} placeholder="DD/MM/AAAA" inputMode="numeric" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+55 (11) 9____-____" inputMode="tel" />
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
