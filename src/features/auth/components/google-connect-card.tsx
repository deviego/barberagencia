import { CheckCircle2 } from "lucide-react";
import { GoogleButton } from "./google-button";

/**
 * "Entrar com Google" no perfil do cliente (ADR 0005, item 6).
 * Já conectado: mostra o estado. Sem Google: botão que liga a conta atual (linkIdentity no navegador).
 */
export function GoogleConnectCard({ connected, error }: { connected: boolean; error: string | null }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <div className="text-overline uppercase text-text-muted">Formas de entrar</div>
      {connected ? (
        <p className="flex items-center gap-2 text-body text-text">
          <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden="true" />
          Google conectado. Você entra com o Google ou com telefone e senha.
        </p>
      ) : (
        <>
          <p className="text-body text-text-2">
            Conecte sua conta do Google para entrar sem digitar senha. Telefone e senha continuam valendo.
          </p>
          {error && (
            <p role="alert" className="rounded-md border border-danger bg-danger-bg px-3 py-2.5 text-caption text-danger">
              {error}
            </p>
          )}
          <GoogleButton mode="link" className="sm:max-w-xs" />
        </>
      )}
    </section>
  );
}
