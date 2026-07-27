"use client";

import { useState, useTransition } from "react";
import { Check, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sendSupportMessage } from "@/features/admin/actions";

const CATEGORIES = [
  { key: "tecnico", label: "Suporte Técnico", hint: "Problemas no sistema, erros, dúvidas de uso." },
  { key: "administrativo", label: "Suporte Administrativo", hint: "Plano, cobrança, cadastro, comercial." },
];

export function SupportForm() {
  const [category, setCategory] = useState("tecnico");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!message.trim()) return setError("Escreva a sua mensagem.");
    startTransition(async () => {
      const res = await sendSupportMessage({ category, subject, message });
      if (res.ok) {
        setSent(true);
        setSubject("");
        setMessage("");
      } else setError(res.error);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-success bg-success-bg p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-white">
          <Check size={24} />
        </span>
        <h2 className="text-h4 font-semibold text-text">Mensagem enviada!</h2>
        <p className="text-body text-text-2">Recebemos o seu contato e retornamos em breve.</p>
        <Button variant="secondary" onClick={() => setSent(false)}>
          Enviar outra
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-5 rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center gap-2 text-overline uppercase text-text-muted">
        <LifeBuoy size={15} /> Falar com o suporte
      </div>

      <div className="flex flex-col gap-2">
        <Label className="mb-0">Tipo de suporte</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors",
                category === c.key ? "border-2 border-accent bg-accent-wash" : "border-border hover:border-accent"
              )}
            >
              <span className="text-body font-semibold text-text">{c.label}</span>
              <span className="text-caption text-text-muted">{c.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Assunto</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumo do que você precisa" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Mensagem</Label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Descreva com detalhes o que você precisa…"
          className="w-full rounded-md border border-border bg-surface p-3 text-body text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}

      <Button className="self-start" loading={pending} onClick={submit}>
        Enviar mensagem
      </Button>
    </div>
  );
}
