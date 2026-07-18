import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS_UI = [
  {
    name: "Essencial",
    price: "R$ 99",
    desc: "Para começar a organizar a barbearia.",
    highlight: false,
    features: [
      { ok: true, text: "Até 100 clientes cadastrados" },
      { ok: true, text: "Relatório financeiro básico — últimos 30 dias" },
      { ok: true, text: "Agendamento" },
      { ok: true, text: "Disparo de WhatsApp manual, um a um" },
      { ok: false, text: "Site de agendamento para o cliente" },
      { ok: false, text: "Plataforma de atendimento (chat/suporte)" },
      { ok: false, text: "Automação de WhatsApp e marketing" },
    ],
  },
  {
    name: "Profissional",
    price: "R$ 199",
    desc: "Para quem quer agenda cheia no automático.",
    highlight: true,
    badge: "Mais popular",
    features: [
      { ok: true, text: "Até 500 clientes cadastrados" },
      { ok: true, text: "Relatório financeiro completo — 12 meses" },
      { ok: true, text: "Agendamento automatizado" },
      { ok: true, text: "Site do cliente incluído (subdomínio)" },
      { ok: true, text: "Plataforma de atendimento (chat + suporte)" },
      { ok: true, text: "Automação de WhatsApp: lembretes e confirmações" },
      { ok: true, text: "Marketing básico — campanhas por segmento" },
    ],
  },
  {
    name: "Advanced",
    price: "R$ 349",
    desc: "Para redes e franquias em escala.",
    highlight: false,
    features: [
      { ok: true, text: "Clientes ilimitados" },
      { ok: true, text: "Relatório financeiro ilimitado + exportação" },
      { ok: true, text: "Agendamento automatizado + recorrência" },
      { ok: true, text: "Site do cliente com domínio próprio" },
      { ok: true, text: "Atendimento com chatbot e filas" },
      { ok: true, text: "Automação total de WhatsApp + campanhas segmentadas" },
      { ok: true, text: "Marketing avançado + consolidado multi-unidades" },
    ],
  },
];

const PLAN_TABLE = [
  { label: "Clientes cadastrados", a: "100", b: "500", c: "Ilimitado" },
  { label: "Relatório financeiro", a: "Básico · 30 dias", b: "Completo · 12 meses", c: "Ilimitado + exportação" },
  { label: "Agendamento", a: "Manual", b: "Automatizado", c: "Automatizado + recorrência" },
  { label: "Site para o cliente", a: "—", b: "Subdomínio", c: "Domínio próprio" },
  { label: "Plataforma de atendimento", a: "—", b: "Chat + suporte", c: "Chatbot + filas" },
  { label: "Disparo de WhatsApp", a: "Manual", b: "Automação (lembretes)", c: "Automação + campanhas" },
  { label: "Marketing", a: "—", b: "Básico (segmentos)", c: "Avançado (jornadas)" },
  { label: "Unidades", a: "1", b: "1", c: "Até 5 + visão de rede" },
];

export default function PlanosSaasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h2 uppercase text-text">Planos da plataforma</h1>
        <p className="text-caption text-text-2">
          O que cada barbearia contrata — limites e recursos por plano. Cobrança mensal, sem fidelidade.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        {PLANS_UI.map((pl) => (
          <div
            key={pl.name}
            className={cn(
              "relative flex flex-col gap-3.5 rounded-lg bg-surface p-6 transition-shadow hover:shadow-sm",
              pl.highlight ? "border-2 border-accent" : "border border-border"
            )}
          >
            {pl.highlight && pl.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill bg-accent px-3.5 py-1 text-[11px] font-bold text-text-inverse">
                {pl.badge}
              </span>
            )}
            <div className="font-display text-[26px] font-extrabold uppercase leading-none text-text">
              {pl.name}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[40px] font-black leading-none text-accent">
                {pl.price}
              </span>
              <span className="text-caption text-text-muted">/mês por unidade</span>
            </div>
            <p className="text-caption text-text-2">{pl.desc}</p>
            <div className="h-px bg-border-subtle" />
            <div className="flex flex-1 flex-col gap-2.5">
              {pl.features.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 text-caption leading-snug">
                  {f.ok ? (
                    <Check size={16} className="mt-px shrink-0 text-success-strong" />
                  ) : (
                    <X size={16} className="mt-px shrink-0 text-text-muted" />
                  )}
                  <span className={f.ok ? "text-text" : "text-text-muted"}>{f.text}</span>
                </div>
              ))}
            </div>
            <button
              className={cn(
                "rounded-md py-3 text-body font-bold transition-opacity hover:opacity-90",
                pl.highlight
                  ? "bg-accent text-text-inverse"
                  : "border border-accent text-accent"
              )}
            >
              Escolher {pl.name}
            </button>
          </div>
        ))}
      </div>

      {/* Comparativo */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 border-b border-border px-5 py-3 text-overline uppercase text-text-muted">
          <span>Comparativo</span>
          <span>Essencial</span>
          <span className="text-accent">Profissional</span>
          <span>Advanced</span>
        </div>
        {PLAN_TABLE.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-2 border-b border-border-subtle px-5 py-3 text-body transition-colors last:border-b-0 hover:bg-accent-wash"
          >
            <span className="font-medium text-text">{row.label}</span>
            <span className="text-text-2">{row.a}</span>
            <span className="font-semibold text-accent">{row.b}</span>
            <span className="text-text-2">{row.c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
