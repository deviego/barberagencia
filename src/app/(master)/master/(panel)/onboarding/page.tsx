"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createTenant } from "@/features/platform/actions";

const PLANS: { key: string; label: string }[] = [
  { key: "personal", label: "Personal" },
  { key: "essencial", label: "Essencial" },
  { key: "advance", label: "Advance" },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [plan, setPlan] = useState("advance");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; adminEmail: string; password: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function onName(v: string) {
    setName(v);
    if (!slugTouched) setSubdomain(slugify(v));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createTenant({ name, subdomain, plan, adminEmail, adminName });
      if (res.ok) setResult({ link: res.link, adminEmail: res.adminEmail, password: res.password });
      else setError(res.error);
    });
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  if (result) {
    const fullLink = typeof window !== "undefined" ? `${window.location.origin}${result.link}` : result.link;
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-5">
        <div className="flex items-center gap-2 text-success-strong">
          <Check size={22} /> <h1 className="text-h3 font-bold text-text">Barbearia criada!</h1>
        </div>
        <p className="text-body text-text-2">
          Envie o link abaixo para a barbearia divulgar aos clientes, e as credenciais para o admin acessar o painel
          (peça para trocar a senha depois).
        </p>

        <Field label="Link da barbearia (clientes)" value={fullLink} onCopy={() => copy(fullLink, "link")} copied={copied === "link"} />
        <Field label="E-mail do admin" value={result.adminEmail} onCopy={() => copy(result.adminEmail, "mail")} copied={copied === "mail"} />
        <Field label="Senha temporária" value={result.password} onCopy={() => copy(result.password, "pass")} copied={copied === "pass"} />

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setName("");
              setSubdomain("");
              setSlugTouched(false);
              setAdminEmail("");
              setAdminName("");
            }}
          >
            <Plus size={15} /> Criar outra
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-h3 font-bold text-text">Nova barbearia</h1>

      <div className="flex flex-col gap-1.5">
        <Label>Nome da barbearia</Label>
        <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Ex.: Barbearia do Zé" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Slug (link /b/…)</Label>
        <Input
          value={subdomain}
          onChange={(e) => {
            setSlugTouched(true);
            setSubdomain(slugify(e.target.value));
          }}
          placeholder="barbearia-do-ze"
        />
        <span className="text-caption text-text-muted">Link: /b/{subdomain || "…"}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Plano</Label>
        <div className="flex gap-2">
          {PLANS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPlan(p.key)}
              className={`rounded-pill border px-4 py-2 text-body transition-colors ${
                plan === p.key ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Nome do admin (opcional)</Label>
        <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Nome do responsável" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>E-mail do admin</Label>
        <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@barbearia.com" />
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}

      <Button loading={pending} onClick={submit}>
        Criar barbearia
      </Button>
    </div>
  );
}

function Field({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-md border border-border bg-inset px-3 py-2">
        <span className="flex-1 truncate text-body text-text tabular">{value}</span>
        <button onClick={onCopy} className="flex items-center gap-1 text-caption font-semibold text-accent hover:underline">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
