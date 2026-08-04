"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setActingTenant } from "@/features/platform/actions";

/** Acesso rápido (Master): entra no painel admin daquela barbearia via "atuar como". */
export function EnterAdminButton({
  tenantId,
  label = "Acessar painel",
  variant = "primary",
  size = "md",
}: {
  tenantId: string;
  label?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function go() {
    start(async () => {
      await setActingTenant(tenantId);
      router.push("/admin");
    });
  }

  return (
    <Button variant={variant} size={size} loading={pending} onClick={go}>
      <LogIn size={15} />
      {label}
    </Button>
  );
}
