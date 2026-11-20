"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { maskPhoneBR } from "@/lib/masks";
import { QUICK_QUEUE_IDENTIFY_MESSAGES, QUICK_QUEUE_MESSAGES } from "../types";

/**
 * Passo do telefone da fila rápida: telefone com DDD e "Continuar".
 * Controlado por fora (`value`/`onChange`) para o que foi digitado sobreviver a erro, falha de
 * conexão e volta do passo do nome. `error` vem do servidor; a validação local cobre só o formato.
 */
export function PhoneStep({
  value,
  onChange,
  error,
  onErrorChange,
  pending = false,
  onContinue,
}: {
  value: string;
  onChange: (masked: string) => void;
  error: string | null;
  onErrorChange: (error: string | null) => void;
  pending?: boolean;
  /** Sem ela (entrada ainda não ligada), "Continuar" avisa na tela: o botão nunca falha calado. */
  onContinue?: (digits: string) => void;
}) {
  const inputId = useId();
  const errorId = useId();

  const digits = value.replace(/\D/g, "");
  const valid = digits.length === 10 || digits.length === 11;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!valid) {
      onErrorChange(QUICK_QUEUE_IDENTIFY_MESSAGES.invalidPhone);
      return;
    }
    if (!onContinue) {
      onErrorChange(QUICK_QUEUE_MESSAGES.entryNotReady);
      return;
    }
    onErrorChange(null);
    onContinue(digits);
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
          enterKeyHint="go"
          placeholder="(00) 00000-0000"
          value={value}
          readOnly={pending}
          onChange={(e) => {
            onChange(maskPhoneBR(e.target.value));
            if (error) onErrorChange(null);
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
