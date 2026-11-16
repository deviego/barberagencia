"use client";

import { useParams } from "next/navigation";
import { RouteError } from "@/components/states/route-error";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { slug } = useParams<{ slug: string }>();
  return (
    <RouteError
      error={error}
      reset={reset}
      homeHref={slug ? `/b/${encodeURIComponent(slug)}` : "/client"}
      homeLabel="Voltar para a barbearia"
      fullScreen
    />
  );
}
