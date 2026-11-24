"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClientAreaBrowserClient } from "@/lib/supabase/client";
import { GOOGLE_CONFIRM_PATH } from "@/features/auth/google-errors";
import { cn } from "@/lib/utils";

/** "G" oficial do Google (cores da marca do Google, exigidas pelas regras de uso do botão). */
function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Botão do Google na área do cliente (ADR 0005).
 * - `signin`: entra/cadastra com Google (PKCE). O callback leva para a confirmação do WhatsApp;
 *   quem já tem conta pronta é mandado para o app pelo servidor.
 * - `link`: cliente logado conecta o Google à conta atual (perfil).
 * A barbearia vem do cookie `bb_tenant`, igual ao login por senha.
 */
export function GoogleButton({
  mode = "signin",
  label,
  className,
}: {
  mode?: "signin" | "link";
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setLoading(true);
    const supabase = createClientAreaBrowserClient();
    const origin = window.location.origin;
    const next = mode === "link" ? "/client/perfil" : GOOGLE_CONFIRM_PATH;
    const redirectTo = `${origin}/client/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: err } =
      mode === "link"
        ? await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } })
        : await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    // Sem erro, o navegador já está indo para o Google: mantém o carregando.
    if (err) {
      setLoading(false);
      setError(
        mode === "link"
          ? "Não deu para conectar com o Google agora. Tente de novo."
          : "Não deu para abrir o Google agora. Tente de novo."
      );
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        loading={loading}
        onClick={onClick}
        className="w-full border-border bg-surface text-text hover:bg-inset hover:text-text"
      >
        {!loading && <GoogleMark />}
        {label ?? (mode === "link" ? "Conectar com Google" : "Entrar com Google")}
      </Button>
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Separador "ou" entre o Google e o formulário de senha. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-caption uppercase text-text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      ou
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
