"use client";

import { useEffect } from "react";
import "@/styles/globals.css";

/**
 * Erro na raiz (inclusive no layout raiz). Substitui o <html> inteiro, então
 * não depende de Providers nem do tenant. Nunca mostra error.message ao usuário.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", { digest: error.digest ?? null });
  }, [error.digest]);

  return (
    <html lang="pt-BR" data-theme="dark">
      <body>
        <main
          role="alert"
          className="flex min-h-screen items-center justify-center px-4 py-12 text-center"
        >
          <div className="w-full max-w-sm">
            <h1 className="text-h4 font-semibold text-text">Algo deu errado</h1>
            <p className="mt-2 text-body text-text-2">
              O sistema teve um problema ao abrir esta página. Tente de novo em alguns segundos.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                // O router pode não estar disponível aqui: recarrega a página inteira.
                onClick={() => window.location.reload()}
                className="h-12 w-full rounded-md bg-accent px-6 font-semibold text-text-inverse"
              >
                Tentar de novo
              </button>
              <a href="/" className="flex h-12 w-full items-center justify-center rounded-md text-text-2">
                Ir para o início
              </a>
            </div>
            {error.digest && <p className="mt-6 text-caption text-text-muted">Código: {error.digest}</p>}
          </div>
        </main>
      </body>
    </html>
  );
}
