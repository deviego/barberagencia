"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Aciona a impressão do navegador (o usuário escolhe "Salvar como PDF"). */
export function PrintButton({ label = "Baixar PDF" }: { label?: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer size={16} /> {label}
    </Button>
  );
}
