"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createDistributor } from "@/features/distributor/actions";
import { maskPhoneBR, maskCPF, maskCNPJ, maskCEP, maskUF } from "@/lib/masks";

type Result = { adminLoginUrl: string; adminEmail: string; password: string; name: string; phone: string };

export default function OnboardingDistribuidorPage() {
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [docType, setDocType] = useState<"CNPJ" | "CPF">("CNPJ");
  const [docNumber, setDocNumber] = useState("");
  const [legalName, setLegalName] = useState("");
  const [respName, setRespName] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrZip, setAddrZip] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createDistributor({
        name,
        adminName,
        adminEmail,
        phone,
        trialEnabled,
        contract: {
          legalName,
          docType,
          docNumber,
          responsibleName: respName || adminName,
          responsibleCpf: respCpf,
          addressStreet: addrStreet,
          addressCity: addrCity,
          addressState: addrState,
          addressZip: addrZip,
        },
      });
      if (res.ok) setResult({ adminLoginUrl: res.adminLoginUrl, adminEmail: res.adminEmail, password: res.password, name: res.name, phone: res.phone });
      else setError(res.error);
    });
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  if (result) {
    const message =
      `Olá! O acesso do distribuidor "${result.name}" já está pronto na Barber Agência 🎉\n\n` +
      `🔐 Painel: ${result.adminLoginUrl}\n` +
      `E-mail: ${result.adminEmail}\n` +
      `Senha temporária: ${result.password}\n` +
      `(troque a senha após o primeiro acesso)`;
    const waDigits = result.phone.replace(/\D/g, "");
    const waHref = waDigits ? `https://wa.me/55${waDigits}?text=${encodeURIComponent(message)}` : null;
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-5">
        <div className="flex items-center gap-2 text-success-strong">
          <Check size={22} /> <h1 className="text-h3 font-bold text-text">Distribuidor criado!</h1>
        </div>
        <Field label="Link do painel" value={result.adminLoginUrl} onCopy={() => copy(result.adminLoginUrl, "url")} copied={copied === "url"} />
        <Field label="E-mail" value={result.adminEmail} onCopy={() => copy(result.adminEmail, "mail")} copied={copied === "mail"} />
        <Field label="Senha temporária" value={result.password} onCopy={() => copy(result.password, "pass")} copied={copied === "pass"} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => copy(message, "msg")}>
            {copied === "msg" ? <Check size={14} /> : <Copy size={14} />} {copied === "msg" ? "Copiado" : "Copiar mensagem"}
          </Button>
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><MessageCircle size={14} /> Abrir no WhatsApp</Button>
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => location.reload()}><Plus size={15} /> Criar outro</Button>
          <Link href="/master/distribuidores"><Button variant="outline"><ArrowLeft size={15} /> Ver distribuidores</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-h3 font-bold text-text">Novo distribuidor</h1>

      <div className="flex flex-col gap-1.5">
        <Label>Nome do distribuidor</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Distribuidora Premium" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Nome do responsável (opcional)</Label>
        <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>E-mail de acesso</Label>
        <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="acesso@distribuidora.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Telefone / WhatsApp (opcional)</Label>
        <Input value={phone} onChange={(e) => setPhone(maskPhoneBR(e.target.value))} inputMode="tel" maxLength={15} placeholder="(11) 99999-9999" />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-inset px-4 py-3">
        <div>
          <div className="text-body font-semibold text-text">Adicionar 15 dias de teste</div>
          <div className="text-caption text-text-muted">{trialEnabled ? "Começa no período gratuito." : "Sem teste — contrato pendente já no 1º acesso."}</div>
        </div>
        <Switch defaultChecked={trialEnabled} onChange={setTrialEnabled} />
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="text-overline uppercase text-text-muted">Dados do contrato</div>
        <div className="flex flex-col gap-1.5">
          <Label>Documento</Label>
          <div className="flex gap-2">
            {(["CNPJ", "CPF"] as const).map((d) => (
              <button key={d} type="button" onClick={() => { setDocType(d); setDocNumber(""); }}
                className={`rounded-pill border px-4 py-1.5 text-caption transition-colors ${docType === d ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"}`}>{d}</button>
            ))}
          </div>
          <Input value={docNumber} onChange={(e) => setDocNumber(docType === "CNPJ" ? maskCNPJ(e.target.value) : maskCPF(e.target.value))} inputMode="numeric" placeholder={docType === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Razão social (opcional)</Label>
          <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5"><Label>Responsável legal</Label><Input value={respName} onChange={(e) => setRespName(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label>CPF do responsável</Label><Input value={respCpf} onChange={(e) => setRespCpf(maskCPF(e.target.value))} inputMode="numeric" /></div>
        </div>
        <div className="flex flex-col gap-1.5"><Label>Endereço</Label><Input value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} placeholder="Rua, número, bairro" /></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_80px_120px]">
          <div className="flex flex-col gap-1.5"><Label>Cidade</Label><Input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label>UF</Label><Input value={addrState} onChange={(e) => setAddrState(maskUF(e.target.value))} /></div>
          <div className="flex flex-col gap-1.5"><Label>CEP</Label><Input value={addrZip} onChange={(e) => setAddrZip(maskCEP(e.target.value))} inputMode="numeric" /></div>
        </div>
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}
      <Button loading={pending} onClick={submit}>Criar distribuidor</Button>
    </div>
  );
}

function Field({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-md border border-border bg-inset px-3 py-2">
        <span className="flex-1 truncate text-body text-text tabular">{value}</span>
        <button onClick={onCopy} className="flex shrink-0 items-center gap-1 text-caption font-semibold text-accent hover:underline">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
