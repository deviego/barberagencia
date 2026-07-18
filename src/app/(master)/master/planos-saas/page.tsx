import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS_UI = [
  {
    name: "Essencial",
    setup: "R$ 139,90",
    monthly: "R$ 65",
    desc: "Para começar a organizar a barbearia.",
    highlight: false,
    features: [
      { ok: true, text: "Cadastrar até 100 clientes na plataforma" },
      { ok: true, text: "Relatório — últimos 30 dias" },
      { ok: true, text: "Atendimento personalizado: agendamentos + notificações push (WhatsApp, e-mail, SMS)" },
      { ok: false, text: "Criação de site para ofertas" },
      { ok: false, text: "Plataforma de atendimento 24h para clientes" },
      { ok: false, text: "Automação: chatbot, campanhas via e-mkt, integração de redes sociais" },
    ],
  },
  {
    name: "Profissional",
    setup: "R$ 199",
    monthly: "R$ 85",
    desc: "Para quem quer agenda cheia e presença online.",
    highlight: true,
    badge: "Mais popular",
    features: [
      { ok: true, text: "Cadastrar até 500 clientes na plataforma" },
      { ok: true, text: "Relatório — últimos 12 meses" },
      { ok: true, text: "Atendimento personalizado: agendamentos + notificações push (WhatsApp, e-mail, SMS)" },
      { ok: true, text: "Criação de site para ofertas" },
      { ok: true, text: "Plataforma de atendimento 24h para clientes" },
      { ok: false, text: "Automação: chatbot, campanhas via e-mkt, integração de redes sociais" },
    ],
  },
  {
    name: "Advanced",
    setup: "R$ 259",
    monthly: "R$ 99",
    desc: "Para redes e franquias em escala.",
    highlight: false,
    features: [
      { ok: true, text: "Clientes ilimitados na plataforma" },
      { ok: true, text: "Relatório ilimitado + exportação" },
      { ok: true, text: "Atendimento personalizado: agendamentos + notificações push (WhatsApp, e-mail, SMS)" },
      { ok: true, text: "Criação de site para ofertas" },
      { ok: true, text: "Plataforma de atendimento 24h para clientes" },
      { ok: true, text: "Automação completa: chatbot + campanhas via e-mkt + integração de redes sociais" },
    ],
  },
];

const PLAN_TABLE = [
  { label: "Clientes cadastrados", a: "100", b: "500", c: "Ilimitado" },
  { label: "Relatório financeiro", a: "30 dias", b: "12 meses", c: "Ilimitado + exportação" },
  { label: "Agendamentos + notificações push", a: "Sim", b: "Sim", c: "Sim" },
  { label: "Site para ofertas", a: "—", b: "Sim", c: "Sim" },
  { label: "Atendimento 24h ao cliente", a: "—", b: "Sim", c: "Sim" },
  { label: "Automação (chatbot / e-mkt / redes)", a: "—", b: "—", c: "Sim" },
  { label: "Adesão", a: "R$ 139,90", b: "R$ 199", c: "R$ 259" },
  { label: "Mensalidade", a: "R$ 65", b: "R$ 85", c: "R$ 99" },
];

export default function PlanosSaasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h2 uppercase text-text">Planos da plataforma</h1>
        <p className="text-caption text-text-2">
          O que cada barbearia contrata — limites e recursos por plano. Valores válidos por 6 meses;
          após esse período, sujeitos a reajuste.
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
                {pl.monthly}
              </span>
              <span className="text-caption text-text-muted">/mês</span>
            </div>
            <div className="text-caption text-text-2">
              Adesão <span className="font-semibold text-text">{pl.setup}</span> · válido por 6 meses
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
                pl.highlight ? "bg-accent text-text-inverse" : "border border-accent text-accent"
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
