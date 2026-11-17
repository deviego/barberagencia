"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { maskPhoneBR } from "@/lib/masks";

/** Retorno da ação de continuar (ligada na #96). Só uma mensagem de erro pronta para o cliente. */
export type PhoneStepResult = { error?: string } | void;

/**
 * Tela inicial da fila rápida: telefone com DDD e "Continuar".
 * A identificação pelo telefone é da #96 (`onContinue`); nesta story a tela só coleta o número.
 */
export function PhoneStep({ onContinue }: { onContinue?: (phone: string) => Promise<PhoneStepResult> }) {
  const inputId = useId();
  const errorId = useId();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const digits = phone.replace(/\D/g, "");
  const valid = digits.length === 10 || digits.length === 11;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError("Confira o telefone: DDD e número.");
      return;
    }
    setError(null);
    if (!onContinue) return;
    startTransition(async () => {
      const res = await onContinue(digits);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-h3 font-black uppercase text-text">Pegue sua senha</h1>
        <p className="mt-2 text-body text-text-2">Digite seu telefone e entre na fila.</p>
      </div>

      <div>
        <Label htmlFor={inputId}>Seu telefone com DDD</Label>
        <Input
          id={inputId}
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="(00) 00000-0000"
          value={phone}
          onChange={(e) => {
            setPhone(maskPhoneBR(e.target.value));
            if (error) setError(null);
          }}
          error={!!error}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="h-12 text-body-lg tabular"
        />
        {error && (
          <p id={errorId} role="alert" className="mt-2 text-caption text-danger">
            {error}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Continuar
      </Button>
    </form>
  );
}
