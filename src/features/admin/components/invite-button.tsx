"use client";

import { useState, useTransition } from "react";
import { Check, Copy, MessageCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { maskPhoneBR } from "@/lib/masks";
import { createInvite } from "@/features/admin/actions";

export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createInvite({ name, phone, email });
      if (res.ok) setLink(`${window.location.origin}/convite/${res.token}`);
      else setError(res.error);
    });
  }
  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setLink(null);
    setError(null);
    setCopied(false);
  }
  const waPhone = phone.replace(/\D/g, "");

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <UserPlus size={16} />
        Convidar cliente
      </Button>
      <Drawer
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Convidar cliente"
        footer={
          !link ? (
            <Button className="w-full" loading={pending} onClick={submit}>
              Gerar convite
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={reset}>
              Novo convite
            </Button>
          )
        }
      >
        {!link ? (
          <div className="flex flex-col gap-4">
            <p className="text-caption text-text-muted">
              O cliente recebe um link (válido por 48h) para confirmar os dados e criar login e senha.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(maskPhoneBR(e.target.value))} inputMode="tel" maxLength={15} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <p className="text-caption text-danger">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-accent bg-accent-wash p-3 text-caption text-text-2 break-all">
              {link}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copiado" : "Copiar link"}
              </Button>
              <a
                href={`https://wa.me/${waPhone ? (waPhone.startsWith("55") ? waPhone : "55" + waPhone) : ""}?text=${encodeURIComponent(`Olá! Crie seu acesso na Barbearia Oliveira 01: ${link}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-caption font-semibold text-white"
                style={{ background: "#25D366" }}
              >
                <MessageCircle size={15} />
                WhatsApp
              </a>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
