"use client";

import { RouteError } from "@/components/states/route-error";

// Totem e painel da TV: sem link para fora (o /b/<slug> leva ao app do cliente e perde o ?k=)
// e com nova tentativa automática, porque na TV ninguém toca na tela.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} autoRetrySeconds={12} fullScreen />;
}
