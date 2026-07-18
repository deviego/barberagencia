"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { TermsModal } from "./terms-modal";

export function SignupForm() {
  const router = useRouter();
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTermsOpen(true);
        }}
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg"
      >
        <div className="flex flex-col gap-1.5">
          <Label>Nome completo</Label>
          <Input placeholder="William Santos de Oliveira" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Nascimento</Label>
            <Input placeholder="DD/MM/AAAA" inputMode="numeric" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Telefone</Label>
            <Input placeholder="+55 (11) 9____-____" inputMode="tel" required />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>E-mail</Label>
          <Input type="email" placeholder="william@email.com" required />
        </div>

        <Button type="submit" size="lg">
          Criar conta
        </Button>

        <p className="text-center text-body text-text-2">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </form>

      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAccept={() => router.push("/otp")}
      />
    </>
  );
}
