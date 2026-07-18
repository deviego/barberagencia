"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MiniAppPreview } from "@/features/platform/components/mini-app-preview";
import { PLANS } from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";
import { formatBRL, cn } from "@/lib/utils";

const STEPS = ["Dados", "Domínio", "Tema", "Plano"];
const PLAN_ORDER: SaasPlanKey[] = ["essencial", "profissional", "advanced"];
const PRESET_COLORS = ["#C9A24B", "#5556EE", "#08D48B", "#FF385C"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Barbearia Oliveira 01");
  const [subdomain, setSubdomain] = useState("oliveira01");
  const [accent, setAccent] = useState("#C9A24B");
  const [plan, setPlan] = useState<SaasPlanKey>("profissional");
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "barber.app";
  const logo = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "BB";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Nova barbearia</h1>

      {/* Stepper */}
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-caption font-bold",
                  i < step && "bg-accent text-text-inverse",
                  i === step && "border-2 border-accent text-accent",
                  i > step && "border border-border text-text-muted"
                )}
              >
                {i < step ? <Check size={16} /> : i + 1}
              </span>
              <span className={cn("text-caption", i === step ? "text-text" : "text-text-muted")}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-3 h-px flex-1", i < step ? "bg-accent" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Nome da barbearia</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Responsável</Label>
              <Input placeholder="Nome do dono/gerente" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>E-mail de acesso</Label>
              <Input type="email" placeholder="dono@barbearia.com" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-1.5">
            <Label>Subdomínio</Label>
            <div className="flex items-center">
              <Input
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                className="rounded-r-none"
              />
              <span className="flex h-10 items-center rounded-r-md border border-l-0 border-border bg-inset px-3 text-body text-text-muted">
                .{appDomain}
              </span>
            </div>
            <p className="mt-1 text-caption text-text-muted">
              O app do cliente ficará em{" "}
              <span className="text-accent tabular">
                {subdomain || "sua-barbearia"}.{appDomain}
              </span>
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Cor primária (acento)</Label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccent(c)}
                      aria-label={`Cor ${c}`}
                      className={cn(
                        "h-9 w-9 rounded-md border-2 transition-transform hover:scale-105",
                        accent.toLowerCase() === c.toLowerCase() ? "border-text" : "border-transparent"
                      )}
                      style={{ background: c }}
                    />
                  ))}
                  <span className="mx-1 h-6 w-px bg-border" />
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="w-28" />
                </div>
              </div>
              <p className="text-caption text-text-muted">
                O preview ao lado atualiza em tempo real com a cor escolhida.
              </p>
            </div>
            <MiniAppPreview accent={accent} name={name} logo={logo} />
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-3">
            {PLAN_ORDER.map((k) => (
              <button
                key={k}
                onClick={() => setPlan(k)}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors",
                  plan === k ? "border-2 border-accent bg-accent-wash" : "border-border hover:border-accent"
                )}
              >
                <span className="font-display text-h5 uppercase text-text">{PLANS[k].label}</span>
                <span className="text-h4 text-accent tabular">{formatBRL(PLANS[k].priceBRL)}/mês</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Continuar</Button>
        ) : (
          <Button>Criar barbearia</Button>
        )}
      </div>
    </div>
  );
}
