"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { salesWaLink, WA_MESSAGES } from "@/features/landing/content";
import { submitDistributorLead } from "@/features/leads/actions";
import { LEAD_CONSENT_TEXT } from "@/features/leads/consent";
import {
  DistributorLeadSchema,
  LEAD_GENERIC_ERROR,
  LEAD_LIMITS,
  leadFieldErrors,
  ORDER_CHANNEL_LABELS,
  ORDER_CHANNELS,
  type DistributorLeadField,
  type DistributorLeadInput,
} from "@/features/leads/schema";
import { BR_UFS } from "@/lib/br-ufs";
import { maskPhoneBR } from "@/lib/masks";

const inputCls =
  "w-full min-w-0 rounded-md border bg-surface px-3 py-3 text-[15px] text-text placeholder:text-text-muted focus-visible:border-focus focus-visible:outline-none aria-[invalid=true]:border-danger";
const labelCls = "text-[13px] font-semibold text-text";
const errorCls = "text-[12px] text-danger";

type Values = {
  name: string;
  company: string;
  city: string;
  state: string;
  whatsapp: string;
  barbershopsCount: string;
  orderChannel: string;
  consent: boolean;
  website: string;
};

const EMPTY: Values = {
  name: "",
  company: "",
  city: "",
  state: "",
  whatsapp: "",
  barbershopsCount: "",
  orderChannel: "",
  consent: false,
  website: "",
};

type Errors = Partial<Record<DistributorLeadField, string>>;

/**
 * Formulário "Para distribuidoras": grava o lead pela server action (nenhum dado vai para analytics/pixel).
 * Validação no client só para mostrar o erro por campo; o servidor revalida tudo.
 */
export function DistributorLeadForm() {
  const id = useId();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setFormError("");

    const input = {
      ...values,
      // Vazio vira NaN no coerce e cai no erro "Informe um número."
      barbershopsCount: values.barbershopsCount === "" ? Number.NaN : values.barbershopsCount,
    } as DistributorLeadInput;

    const parsed = DistributorLeadSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(leadFieldErrors(parsed.error));
      return;
    }

    setSending(true);
    try {
      const res = await submitDistributorLead(input);
      if (res.ok) {
        setDone(true);
        setValues(EMPTY);
        return;
      }
      setErrors(res.fieldErrors ?? {});
      if (res.error || !res.fieldErrors) setFormError(res.error ?? LEAD_GENERIC_ERROR);
    } catch {
      setFormError(LEAD_GENERIC_ERROR);
    } finally {
      setSending(false);
    }
  }

  const waButton = (
    <a
      href={salesWaLink(WA_MESSAGES.distributor)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md border border-border px-4 py-3 text-center text-[14px] font-semibold text-text transition-colors hover:border-accent hover:text-accent"
    >
      <MessageCircle size={16} aria-hidden />
      Chamar no WhatsApp
    </a>
  );

  if (done) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-lg border border-accent bg-surface p-6 text-center sm:p-8"
      >
        <CheckCircle2 size={40} className="text-[color:var(--bb-success)]" aria-hidden />
        <p className="m-0 font-display text-[28px] font-black uppercase leading-none">Recebemos!</p>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">A gente te chama no WhatsApp.</p>
        {waButton}
      </div>
    );
  }

  const field = (key: DistributorLeadField) => ({
    id: `${id}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  });
  const err = (key: DistributorLeadField) =>
    errors[key] ? (
      <span id={`${id}-${key}-error`} className={errorCls}>
        {errors[key]}
      </span>
    ) : null;
  const border = (key: DistributorLeadField) => (errors[key] ? "" : "border-border");

  return (
    <form
      onSubmit={submit}
      noValidate
      className="relative flex flex-col gap-4 rounded-lg border border-border bg-inset p-4 sm:p-8"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className={labelCls}>
          Seu nome
        </label>
        <input
          {...field("name")}
          className={`${inputCls} ${border("name")}`}
          autoComplete="name"
          maxLength={LEAD_LIMITS.name}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
        />
        {err("name")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-company`} className={labelCls}>
          Nome da distribuidora
        </label>
        <input
          {...field("company")}
          className={`${inputCls} ${border("company")}`}
          autoComplete="organization"
          maxLength={LEAD_LIMITS.company}
          value={values.company}
          onChange={(e) => set("company", e.target.value)}
        />
        {err("company")}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${id}-city`} className={labelCls}>
            Cidade
          </label>
          <input
            {...field("city")}
            className={`${inputCls} ${border("city")}`}
            autoComplete="address-level2"
            maxLength={LEAD_LIMITS.city}
            value={values.city}
            onChange={(e) => set("city", e.target.value)}
          />
          {err("city")}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${id}-state`} className={labelCls}>
            UF
          </label>
          <select
            {...field("state")}
            className={`${inputCls} h-[50px] ${border("state")}`}
            autoComplete="address-level1"
            value={values.state}
            onChange={(e) => set("state", e.target.value)}
          >
            <option value="">--</option>
            {BR_UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
          {err("state")}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-whatsapp`} className={labelCls}>
          WhatsApp com DDD
        </label>
        <input
          {...field("whatsapp")}
          className={`${inputCls} ${border("whatsapp")}`}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(00) 00000-0000"
          maxLength={15}
          value={values.whatsapp}
          onChange={(e) => set("whatsapp", maskPhoneBR(e.target.value))}
        />
        {err("whatsapp")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-barbershopsCount`} className={labelCls}>
          Quantas barbearias você atende?
        </label>
        <input
          {...field("barbershopsCount")}
          className={`${inputCls} ${border("barbershopsCount")}`}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={values.barbershopsCount}
          onChange={(e) => set("barbershopsCount", e.target.value.replace(/\D/g, ""))}
        />
        {err("barbershopsCount")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-orderChannel`} className={labelCls}>
          Como você recebe pedido hoje?
        </label>
        <select
          {...field("orderChannel")}
          className={`${inputCls} h-[50px] ${border("orderChannel")}`}
          value={values.orderChannel}
          onChange={(e) => set("orderChannel", e.target.value)}
        >
          <option value="">Escolha uma opção</option>
          {ORDER_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {ORDER_CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
        {err("orderChannel")}
      </div>

      {/* Honeypot: fora da tela, humano não vê nem tabula para ele. */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Site</label>
        <input
          id={`${id}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(e) => set("website", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-[1.5] text-text-2">
          <input
            {...field("consent")}
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[color:var(--bb-accent)]"
            checked={values.consent}
            onChange={(e) => set("consent", e.target.checked)}
          />
          <span>
            {LEAD_CONSENT_TEXT}{" "}
            <Link href="/privacidade" target="_blank" className="font-semibold text-accent underline underline-offset-2">
              Política de privacidade
            </Link>
          </span>
        </label>
        {err("consent")}
      </div>

      {formError && (
        <p role="alert" className={`m-0 ${errorCls} text-[13px]`}>
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={!values.consent || sending}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-accent px-4 py-3.5 text-[15px] font-bold text-text-inverse transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {sending ? "Enviando..." : "Quero cadastrar minha distribuidora"}
        </button>
        {waButton}
      </div>
    </form>
  );
}
