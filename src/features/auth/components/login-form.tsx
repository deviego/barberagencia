"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "./password-input";
import { signInWithPassword } from "../services/auth-service";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithPassword(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg"
    >
      <div className="flex flex-col gap-1.5">
        <Label>E-mail ou telefone</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="william@email.com"
          autoComplete="username"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="mb-0">Senha</Label>
          <Link href="/recuperar-senha" className="text-caption text-accent hover:underline">
            Esqueceu a senha?
          </Link>
        </div>
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}

      <Button type="submit" size="lg" loading={loading}>
        Entrar
      </Button>

      <p className="text-center text-body text-text-2">
        Primeira inscrição?{" "}
        <Link href="/cadastro" className="font-semibold text-accent hover:underline">
          Cadastrar
        </Link>
      </p>
    </form>
  );
}
