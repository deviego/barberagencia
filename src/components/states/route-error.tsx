"use client";

import { startTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Para onde o link "voltar" leva (início da área). */
  homeHref: string;
  homeLabel?: string;
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
  fullScreen = false,
}: RouteErrorProps) {
  const router = useRouter();
  useEffect(() => {
    console.error("[route-error]", { digest: error.digest ?? null });
  }, [error.digest]);

  // reset() sozinho só re-renderiza o boundary no cliente; erro de Server Component
  // precisa buscar o payload RSC de novo (router.refresh) para sair da tela de erro.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

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
          <Link href={homeHref} className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "w-full")}>
            {homeLabel}
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-caption text-text-muted">Código: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
