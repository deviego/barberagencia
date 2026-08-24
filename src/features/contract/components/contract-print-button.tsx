"use client";

import { useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Baixar o contrato como PDF via impressão do navegador ("Salvar como PDF").
 * Marca o body com `printing-contract` para o CSS (@media print em globals.css)
 * isolar o `.contract-print`, imprime, e limpa a classe no afterprint.
 */
export function ContractPrintButton({
  label = "Baixar contrato (PDF)",
  onBeforePrint,
  variant = "outline",
  className,
}: {
  label?: string;
  onBeforePrint?: () => void;
  variant?: "outline" | "primary" | "ghost";
  className?: string;
}) {
  useEffect(() => {
    const cleanup = () => document.body.classList.remove("printing-contract");
    window.addEventListener("afterprint", cleanup);
    return () => {
      window.removeEventListener("afterprint", cleanup);
      cleanup();
    };
  }, []);

  function print() {
    onBeforePrint?.();
    document.body.classList.add("printing-contract");
    // deixa o layout aplicar as classes de print antes de abrir o diálogo
    requestAnimationFrame(() => window.print());
  }

  return (
    <Button variant={variant} size="sm" onClick={print} className={className}>
      <Download size={14} /> {label}
    </Button>
  );
}
