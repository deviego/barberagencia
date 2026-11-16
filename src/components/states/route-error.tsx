"use client";

import { startTransition, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Para onde o link "voltar" leva (início da área). Sem ele, fica só "Tentar de novo". */
  homeHref?: string;
  homeLabel?: string;
  /**
   * Tenta de novo sozinho a cada N segundos (telas sem ninguém para tocar, como o painel da TV).
   * Sem ele, só o botão tenta de novo.
   */
  autoRetrySeconds?: number;
  /** Ocupa a tela toda (páginas sem shell, como o link público). */
  fullScreen?: boolean;
}

/**
 * Estado de erro compartilhado pelos error.tsx de cada área.
 * Nunca mostra error.message/stack ao usuário: só registra o digest no console.
 */
export function RouteError({
  error,
  reset,
  homeHref,
  homeLabel = "Voltar ao início",
  autoRetrySeconds,
  fullScreen = false,
}: RouteErrorProps) {
  const router = useRouter();
  useEffect(() => {
    console.error("[route-error]", { digest: error.digest ?? null });
  }, [error.digest]);

  // reset() sozinho só re-renderiza o boundary no cliente; erro de Server Component
  // precisa buscar o payload RSC de novo (router.refresh) para sair da tela de erro.
  const retry = useCallback(
    () =>
      startTransition(() => {
        router.refresh();
        reset();
      }),
    [router, reset]
  );

  useEffect(() => {
    if (!autoRetrySeconds) return;
    const everyMs = autoRetrySeconds * 1000;
    let pending: AbortController | null = null;
    const timer = setInterval(async () => {
      // Uma checagem por volta: a anterior, se ainda estiver pendurada, é cancelada aqui.
      pending?.abort();
      const check = new AbortController();
      pending = check;
      try {
        // Só tenta de novo com o servidor respondendo: se o refresh falhar na rede, o Next
        // recarrega a página inteira e a tela cairia no erro do navegador, de onde não volta.
        const res = await fetch(window.location.href, { method: "HEAD", cache: "no-store", signal: check.signal });
        if (res.ok) retry();
      } catch {
        // Sem rede, servidor fora do ar ou checagem cancelada: espera a próxima volta.
      }
    }, everyMs);
    return () => {
      clearInterval(timer);
      pending?.abort();
    };
  }, [autoRetrySeconds, retry]);

  return (
    <div
      role="alert"
      className={cn(
        "flex w-full items-center justify-center px-4 py-12",
        fullScreen ? "min-h-screen" : "min-h-[60vh]"
      )}
    >
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-pill bg-danger-bg text-danger">
          <AlertTriangle size={22} aria-hidden />
        </div>
        <h1 className="text-h4 font-semibold text-text">Algo deu errado por aqui</h1>
        <p className="mt-2 text-body text-text-2">
          Não conseguimos carregar esta tela. Tente de novo em alguns segundos.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button size="lg" onClick={retry} className="w-full">
            <RotateCcw size={16} aria-hidden />
            Tentar de novo
          </Button>
          {homeHref && (
            <Link href={homeHref} className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "w-full")}>
              {homeLabel}
            </Link>
          )}
        </div>
        {autoRetrySeconds ? (
          <p className="mt-4 text-caption text-text-muted">Esta tela tenta de novo sozinha a cada poucos segundos.</p>
        ) : null}
        {error.digest && (
          <p className="mt-6 text-caption text-text-muted">Código: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
