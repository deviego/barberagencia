import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS_UI = [
  {
    name: "Personal",
    monthly: "R$ 69,90",
    monthlyNote: "nos 3 primeiros meses · depois R$ 129,90/mês",
    trial: "15 dias grátis · sem adesão",
    desc: "Para continuar a organizar a sua barbearia. Aqui você controla o seu negócio em todas as camadas.",
    highlight: false,
    features: [
      { ok: true, text: "Plataforma personalizada para o administrador (1 admin por CNPJ)" },
      { ok: true, text: "Inscrições para até 20 clientes mensalistas" },
      { ok: true, text: "Cadastro de até 3 profissionais" },
      { ok: true, text: "Relatórios de vendas" },
      { ok: true, text: "300 agendamentos/mês (~10/dia) com alertas WhatsApp/e-mail/SMS" },
      { ok: true, text: "Atendimento humanizado" },
      { ok: false, text: "Atendimento por chat com auxílio de bot IA" },
      { ok: false, text: "Recuperação de cadastros abandonados" },
      { ok: false, text: "Display virtual para produtos" },
      { ok: false, text: "Campanhas via e-mkt + integração de redes sociais" },
      { ok: false, text: "Emissão de nota fiscal via plataforma" },
      { ok: false, text: "Serviços de venda direta via plataforma" },
      { ok: false, text: "Gateway de pagamento via API / Webhooks" },
    ],
  },
  {
    name: "Essencial",
    monthly: "R$ 189,90",
    monthlyNote: "por mês",
    trial: "15 dias grátis · sem adesão",
    desc: "Excelente para quem precisa eliminar gargalos de forma eficaz. Gerencie o negócio com inteligência e versatilidade.",
    highlight: true,
    badge: "Mais popular",
    features: [
      { ok: true, text: "Plataforma personalizada para o administrador (3 admins por CNPJ)" },
      { ok: true, text: "Inscrições para até 90 clientes mensalistas" },
      { ok: true, text: "Cadastro de até 5 profissionais" },
      { ok: true, text: "Relatórios de vendas" },
      { ok: true, text: "1.500 agendamentos/mês (~50/dia) com alertas WhatsApp/e-mail/SMS" },
      { ok: true, text: "Atendimento humanizado + auxílio de bot IA" },
      { ok: true, text: "Recuperação de cadastros abandonados" },
      { ok: true, text: "Display virtual para produtos personalizados" },
      { ok: true, text: "Campanhas via e-mkt + integração de redes sociais" },
      { ok: false, text: "Emissão de nota fiscal via plataforma" },
      { ok: false, text: "Serviços de venda direta via plataforma" },
      { ok: false, text: "Gateway de pagamento via API / Webhooks" },
    ],
  },
  {
    name: "Advance",
    monthly: "a partir de R$ 249,90",
    monthlyNote: "por mês",
    trial: "15 dias grátis · sem adesão",
    desc: "Para quem busca o equilíbrio entre sofisticação no atendimento e controle total da operação. Eleve o padrão enquanto a tecnologia cuida do resto.",
    highlight: false,
    features: [
      { ok: true, text: "Plataforma personalizada para o administrador (4 admins por CNPJ)" },
      { ok: true, text: "Inscrições ILIMITADAS para clientes mensalistas" },
      { ok: true, text: "Cadastro de até 8 profissionais" },
      { ok: true, text: "Relatórios de vendas" },
      { ok: true, text: "3.000 agendamentos/mês (~100/dia) com alertas WhatsApp/e-mail/SMS" },
      { ok: true, text: "Atendimento humanizado + auxílio de bot IA" },
      { ok: true, text: "Recuperação de cadastros abandonados" },
      { ok: true, text: "Display virtual para produtos personalizados" },
      { ok: true, text: "Campanhas via e-mkt + integração de redes sociais" },
      { ok: true, text: "Emissão de nota fiscal via plataforma" },
      { ok: true, text: "Serviços de venda direta via plataforma" },
      { ok: true, text: "Gateway de pagamento via API / Webhooks" },
    ],
  },
];

const PLAN_TABLE = [
  { label: "Administradores por CNPJ", a: "1", b: "3", c: "4" },
  { label: "Clientes mensalistas", a: "20", b: "90", c: "Ilimitados" },
  { label: "Profissionais", a: "3", b: "5", c: "8" },
  { label: "Relatórios de vendas", a: "Sim", b: "Sim", c: "Sim" },
  { label: "Agendamentos por mês", a: "300", b: "1.500", c: "3.000" },
  { label: "Alertas WhatsApp / e-mail / SMS", a: "Sim", b: "Sim", c: "Sim" },
  { label: "Atendimento humanizado", a: "Sim", b: "Sim", c: "Sim" },
  { label: "Chat com bot IA", a: "—", b: "Sim", c: "Sim" },
  { label: "Recuperação de cadastros", a: "—", b: "Sim", c: "Sim" },
  { label: "Display virtual de produtos", a: "—", b: "Sim", c: "Sim" },
  { label: "Campanhas e-mkt + redes sociais", a: "—", b: "Sim", c: "Sim" },
  { label: "Nota fiscal via plataforma", a: "—", b: "—", c: "Sim" },
  { label: "Venda direta via plataforma", a: "—", b: "—", c: "Sim" },
  { label: "Gateway (API) / Webhooks", a: "—", b: "—", c: "Sim" },
  { label: "Mensalidade", a: "R$ 69,90*", b: "R$ 189,90", c: "a partir de R$ 249,90" },
];

export default function PlanosSaasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h2 uppercase text-text">Planos da plataforma</h1>
        <p className="text-caption text-text-2">
          Sem adesão · 15 dias de experimentação. A cobrança inicia após 7 dias corridos — o
          cancelamento é livre nesse período.
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
            <div>
              <div className="font-display text-[34px] font-black leading-none text-accent">
                {pl.monthly}
              </div>
              <div className="mt-1 text-caption text-text-muted">{pl.monthlyNote}</div>
            </div>
            <span className="w-fit rounded-pill bg-success-bg px-2.5 py-0.5 text-[11px] font-semibold text-success-strong">
              {pl.trial}
            </span>
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
              Começar teste grátis
            </button>
          </div>
        ))}
      </div>

      {/* Comparativo */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 border-b border-border px-5 py-3 text-overline uppercase text-text-muted">
          <span>Comparativo</span>
          <span>Personal</span>
          <span className="text-accent">Essencial</span>
          <span>Advance</span>
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

      <p className="text-caption text-text-muted">
        * Personal: R$ 69,90/mês nos 3 primeiros meses, depois R$ 129,90/mês. Todos os planos têm 15
        dias de experimentação, sem adesão.
      </p>
    </div>
  );
}
