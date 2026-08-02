"use client";

import { useState } from "react";
import { salesWaLink, WA_MESSAGES } from "@/features/landing/content";
import { maskPhoneBR } from "@/lib/masks";

const inputCls =
  "rounded-md border border-border bg-surface px-3 py-3 text-[14px] text-text placeholder:text-text-muted focus-visible:border-focus focus-visible:outline-none";

/** Formulário do CTA — monta a mensagem com os dados e abre o WhatsApp comercial. */
export function ContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const link = salesWaLink(WA_MESSAGES.demo({ name, phone, email }));
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-md border border-border bg-inset p-6"
    >
      <span className="text-[13px] font-semibold text-text">Falar com um especialista</span>
      <input className={inputCls} placeholder="Nome da barbearia" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        className={inputCls}
        placeholder="WhatsApp com DDD"
        inputMode="tel"
        maxLength={15}
        value={phone}
        onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
      />
      <input className={inputCls} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-3.5 text-[14px] font-bold text-text-inverse transition-colors hover:bg-accent-hover"
      >
        Quero uma demonstração
      </button>
      <span className="text-[11px] text-text-muted">Retornamos em até 1 dia útil. Sem spam.</span>
    </form>
  );
}
