"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { QUICK_QUEUE_IDENTIFY_MESSAGES } from "../types";

export const NAME_MAX = 60;

/** Checagem local só para o cliente não esperar o servidor à toa. Quem decide é o servidor. */
function localNameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.replace(/[^\p{L}]/gu, "").length < 2) return QUICK_QUEUE_IDENTIFY_MESSAGES.invalidName;
  if (!/^[\p{L}\p{M}\s.'’-]+$/u.test(trimmed)) return QUICK_QUEUE_IDENTIFY_MESSAGES.nameLettersOnly;
  return null;
}

/**
 * Passo do nome (só cliente novo nesta barbearia): um campo, sem nascimento, e-mail ou senha.
 * Controlado por fora para o nome continuar na tela depois de erro, falha ou volta ao telefone.
 */
export function NameStep({
  value,
  onChange,
  error,
  onErrorChange,
  pending = false,
  onContinue,
  onBack,
}: {
  value: string;
  onChange: (name: string) => void;
  error: string | null;
  onErrorChange: (error: string | null) => void;
  pending?: boolean;
  onContinue: (name: string) => void;
  onBack: () => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const local = localNameError(value);
    if (local) {
      onErrorChange(local);
      return;
    }
    onErrorChange(null);
    onContinue(value.trim());
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-h3 font-black uppercase text-text">Primeira vez por aqui?</h1>
        <p className="mt-2 text-body text-text-2">Como você se chama?</p>
      </div>

      <div>
        <Label htmlFor={inputId}>Seu nome</Label>
        <Input
          ref={inputRef}
          id={inputId}
          name="name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="go"
          maxLength={NAME_MAX}
          value={value}
          readOnly={pending}
          onChange={(e) => {
            onChange(e.target.value);
            if (error) onErrorChange(null);
          }}
          error={!!error}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="h-12 text-body-lg"
        />
        {error && (
          <p id={errorId} role="alert" className="mt-2 text-caption text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Continuar
        </Button>
        <Button type="button" variant="ghost" size="lg" className="w-full" disabled={pending} onClick={onBack}>
          Trocar telefone
        </Button>
      </div>
    </form>
  );
}
