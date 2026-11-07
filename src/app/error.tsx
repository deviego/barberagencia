"use client";

import { RouteError } from "@/components/states/route-error";

// Raiz: landing, logins, callbacks de auth e (legal). O layout raiz continua de pé;
// só erro no próprio layout raiz cai no global-error.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} homeHref="/" homeLabel="Ir para o início" fullScreen />;
}
