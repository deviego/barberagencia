import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { LandingHeader } from "@/features/landing/components/landing-header";
import { DeviceShowcase } from "@/features/landing/components/device-showcase";
import { Faq } from "@/features/landing/components/faq";
import { ContactForm } from "@/features/landing/components/contact-form";
import { Icon } from "@/features/landing/components/icon";
import {
  AFTER,
  BEFORE,
  CLIENT_APP_IMAGE,
  CLIENT_FEATURES,
  FOOTER_COLS,
  METRICS,
  PLAN_TABLE,
  PLANS,
  SECTORS,
  STEPS,
  salesWaLink,
  WA_MESSAGES,
} from "@/features/landing/content";

export const metadata: Metadata = {
  title: "barberagencia — a barbearia inteira em uma plataforma",
  description:
    "Plataforma white-label de agendamento, assinaturas, financeiro e atendimento para barbearias. Com a sua marca, no seu domínio. 15 dias grátis, sem cartão.",
};

const H2 = "font-display font-black uppercase leading-[0.98] text-[40px] sm:text-[52px] lg:text-[56px]";
const OVERLINE = "text-[12px] font-semibold uppercase tracking-[0.12em] text-accent";

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg text-text" style={{ fontFamily: "var(--bb-font-ui)" }}>
      <LandingHeader />

      <main>
        {/* HERO */}
        <section id="produto" className="relative overflow-hidden px-6 pt-16 sm:px-10 sm:pt-[88px]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 55% 45% at 50% -5%, var(--bb-accent-wash), transparent 70%)" }}
          />
          <div className="relative mx-auto flex max-w-[1180px] flex-col items-center gap-6 text-center">
            <div className="inline-flex items-center gap-2.5 rounded-pill border border-border bg-surface px-4 py-1.5 text-[13px] text-text-2">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--bb-success)" }} />
              15 dias de experimentação · sem adesão · cancelamento livre
            </div>
            <h1 className="m-0 max-w-[900px] font-display text-[46px] font-black uppercase leading-[0.92] tracking-[0.01em] sm:text-[68px] lg:text-[86px]">
              A barbearia inteira
              <br />
              em <span className="text-accent">uma plataforma</span>
            </h1>
            <p className="m-0 max-w-[620px] text-[17px] leading-[1.55] text-text-2 sm:text-[18px]">
              Agenda, mensalistas, financeiro, produtos e atendimento no mesmo lugar — com a sua marca, no seu domínio.
              Seu cliente agenda sozinho; você acompanha tudo em tempo real.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={salesWaLink(WA_MESSAGES.trial)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-accent px-[30px] py-[15px] text-[15px] font-bold text-text-inverse shadow-lg transition-colors hover:bg-accent-hover"
              >
                Começar teste grátis
              </a>
              <a
                href="#contato"
                className="inline-flex items-center gap-2 rounded-md border border-border px-[26px] py-[15px] text-[15px] font-semibold text-text transition-colors hover:border-accent hover:text-accent"
              >
                <Icon name="phone" size={16} />
                Falar com um especialista
              </a>
            </div>
            <div className="flex flex-wrap justify-center gap-x-7 gap-y-2 text-[13px] text-text-muted">
              {["Sem cartão para testar", "Setup em 1 dia", "Suporte humano em português"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Icon name="check" size={15} className="text-[color:var(--bb-success)]" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <DeviceShowcase />
        </section>

        {/* MÉTRICAS */}
        <section className="mx-auto mt-[88px] max-w-[1180px] px-6 sm:px-10">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.label} className="flex flex-col gap-1.5 bg-surface px-6 py-7">
                <span className="font-display text-[40px] font-black leading-none text-accent">{m.value}</span>
                <span className="text-[13px] leading-[1.4] text-text-2">{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* BENEFÍCIOS */}
        <section id="beneficios" className="mx-auto mt-28 flex max-w-[1180px] flex-col gap-10 px-6 sm:px-10">
          <div className="flex max-w-[680px] flex-col gap-3">
            <span className={OVERLINE}>Tudo o que você ganha</span>
            <h2 className={`m-0 ${H2}`}>
              Um setor de cada vez,
              <br />
              todos no mesmo painel
            </h2>
            <p className="m-0 text-[16px] leading-[1.55] text-text-2">
              Não é só agenda. É a operação inteira da barbearia — do primeiro contato do cliente ao fechamento do caixa.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {SECTORS.map((s) => (
              <div
                key={s.title}
                className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-7 transition-colors hover:border-accent hover:shadow-md"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-accent-wash text-accent">
                  <Icon name={s.icon} size={22} />
                </span>
                <div className="text-[18px] font-semibold">{s.title}</div>
                <p className="m-0 text-[14px] leading-[1.55] text-text-2">{s.desc}</p>
                <div className="mt-0.5 flex flex-col gap-2">
                  {s.points.map((p) => (
                    <div key={p} className="flex items-start gap-2.5 text-[13px] leading-[1.45] text-text-2">
                      <Icon name="check" size={15} className="mt-0.5 shrink-0 text-[color:var(--bb-success)]" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ANTES / DEPOIS */}
        <section className="mx-auto mt-28 flex max-w-[1180px] flex-col gap-8 px-6 sm:px-10">
          <div className="flex max-w-[640px] flex-col gap-3">
            <span className={OVERLINE}>O que muda de verdade</span>
            <h2 className={`m-0 ${H2}`}>
              Do caderno
              <br />
              ao piloto automático
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(255,56,92,0.12)" }}>
                  <Icon name="x" size={17} className="text-[color:var(--bb-danger)]" />
                </span>
                <span className="text-[17px] font-semibold">Sem a plataforma</span>
              </div>
              {BEFORE.map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[14px] leading-[1.5] text-text-muted">
                  <Icon name="minus" size={15} className="mt-[3px] shrink-0" />
                  {t}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-4 rounded-lg border-2 border-accent bg-surface p-7 shadow-lg">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-success-bg">
                  <Icon name="check" size={17} className="text-[color:var(--bb-success)]" />
                </span>
                <span className="text-[17px] font-semibold">Com a barberagencia</span>
              </div>
              {AFTER.map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[14px] leading-[1.5] text-text">
                  <Icon name="check" size={15} className="mt-[3px] shrink-0 text-[color:var(--bb-success)]" />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* APP DO CLIENTE */}
        <section id="cliente" className="mx-auto mt-28 max-w-[1180px] px-6 sm:px-10">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_380px]">
            <div className="flex flex-col gap-4.5" style={{ gap: 18 }}>
              <span className={OVERLINE}>A visão do seu cliente</span>
              <h2 className={`m-0 ${H2}`}>
                Ele agenda sozinho,
                <br />
                com a sua marca
              </h2>
              <p className="m-0 max-w-[520px] text-[16px] leading-[1.6] text-text-2">
                Seu cliente entra no site da <strong className="text-text">sua</strong> barbearia — logo, cores e domínio
                seus. Escolhe serviço, barbeiro e horário, assina um combo mensal e acompanha o saldo de cortes. Você só
                confirma.
              </p>
              <div className="mt-1 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {CLIENT_FEATURES.map((c) => (
                  <div key={c.title} className="flex items-start gap-2.5 text-[14px] leading-[1.45]">
                    <Icon name={c.icon} size={17} className="mt-0.5 shrink-0 text-accent" />
                    <div>
                      <div className="font-semibold">{c.title}</div>
                      <div className="text-[13px] text-text-muted">{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative flex w-[300px] max-w-full sm:w-[320px]">
                <div className="pointer-events-none absolute inset-x-[6%] -bottom-5 h-[54px] rounded-[50%]" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,.55), transparent 72%)", filter: "blur(22px)" }} />
                <div className="pointer-events-none absolute inset-x-[8%] bottom-[8%] top-[12%] rounded-[60px]" style={{ background: "var(--bb-accent)", opacity: 0.16, filter: "blur(60px)" }} />
                <div className="relative w-full rounded-[40px]" style={{ border: "11px solid #1C1C1C", background: "#1C1C1C", boxShadow: "0 1px 0 0 rgba(255,255,255,.10) inset, 0 0 0 1px rgba(0,0,0,.7), 0 24px 48px -18px rgba(0,0,0,.85)" }}>
                  <div className="absolute left-1/2 top-3 z-[2] h-[22px] w-[92px] -translate-x-1/2 rounded-pill" style={{ background: "#1C1C1C" }} />
                  <div className="relative aspect-[9/19.5] overflow-hidden rounded-[30px] bg-inset">
                    <Image src={CLIENT_APP_IMAGE} alt="App do cliente da barbearia" fill sizes="320px" className="object-cover" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section className="mx-auto mt-28 flex max-w-[1180px] flex-col gap-9 px-6 sm:px-10">
          <div className="flex max-w-[620px] flex-col gap-3">
            <span className={OVERLINE}>Implantação</span>
            <h2 className={`m-0 ${H2}`}>No ar em 4 passos</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((st) => (
              <div
                key={st.num}
                className="flex flex-col gap-3 pt-5"
                style={{ borderTop: `2px solid ${st.strong ? "var(--bb-accent)" : "var(--bb-n700)"}` }}
              >
                <span className="font-display text-[30px] font-black leading-none text-accent">{st.num}</span>
                <div className="text-[16px] font-semibold">{st.title}</div>
                <p className="m-0 text-[14px] leading-[1.5] text-text-2">{st.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PLANOS */}
        <section id="planos" className="mx-auto mt-28 flex max-w-[1180px] flex-col gap-9 px-6 sm:px-10">
          <div className="flex flex-col items-center gap-3.5 text-center">
            <span className={OVERLINE}>Planos</span>
            <h2 className="m-0 font-display text-[40px] font-black uppercase leading-[0.98] sm:text-[54px] lg:text-[60px]">
              Escolha o plano da
              <br />
              sua barbearia
            </h2>
            <p className="m-0 max-w-[600px] text-[15px] leading-[1.55] text-text-2">
              Sem adesão · 15 dias de experimentação. A cobrança inicia após 7 dias corridos — o cancelamento é livre
              nesse período.
            </p>
          </div>
          <div className="grid items-stretch gap-5 pt-3 md:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((pl) => (
              <div
                key={pl.name}
                className="relative flex flex-col gap-4 rounded-lg bg-surface p-[30px]"
                style={{
                  border: pl.highlight ? "2px solid var(--bb-accent)" : "1px solid var(--bb-border)",
                  boxShadow: pl.highlight ? "var(--bb-shadow-lg)" : "none",
                }}
              >
                {pl.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill bg-accent px-4 py-1 text-[11px] font-bold text-text-inverse">
                    Mais popular
                  </span>
                )}
                <div className="font-display text-[30px] font-extrabold uppercase">{pl.name}</div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-display text-[46px] font-black leading-none text-accent">{pl.price}</span>
                  <span className="text-[12px] text-text-muted">{pl.cycle}</span>
                </div>
                <span className="self-start rounded-pill bg-success-bg px-3 py-1 text-[11px] font-semibold text-[color:var(--bb-success)]">
                  15 dias grátis · sem adesão
                </span>
                <p className="m-0 text-[13px] leading-[1.55] text-text-2">{pl.desc}</p>
                <div className="h-px bg-border-subtle" />
                <div className="flex flex-1 flex-col gap-2.5">
                  {pl.features.map((f) => (
                    <div key={f.text} className="flex items-start gap-2.5 text-[13px] leading-[1.45]">
                      <Icon
                        name={f.ok ? "check" : "x"}
                        size={15}
                        className={`mt-0.5 shrink-0 ${f.ok ? "text-[color:var(--bb-success)]" : "text-text-muted"}`}
                      />
                      <span className={f.ok ? "text-text" : "text-text-muted"}>{f.text}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={salesWaLink(WA_MESSAGES.trial)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md py-3.5 text-center text-[14px] font-bold transition-opacity hover:opacity-90"
                  style={{
                    border: pl.highlight ? "none" : "1px solid var(--bb-accent)",
                    background: pl.highlight ? "var(--bb-accent)" : "transparent",
                    color: pl.highlight ? "var(--bb-text-inverse)" : "var(--bb-accent)",
                  }}
                >
                  Começar teste grátis
                </a>
              </div>
            ))}
          </div>

          {/* Tabela comparativa */}
          <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[1.7fr_1fr_1fr_1fr] gap-2 border-b border-border px-6 py-3.5 text-[11px] uppercase tracking-[0.06em] text-text-muted">
                <span>Comparativo</span>
                <span>Personal</span>
                <span className="text-accent">Essencial</span>
                <span>Advance</span>
              </div>
              {PLAN_TABLE.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1.7fr_1fr_1fr_1fr] items-center gap-2 border-b border-border-subtle px-6 py-3.5 text-[13px] transition-colors hover:bg-accent-wash"
                >
                  <span className="font-medium">{row.label}</span>
                  <span className={row.a === "—" ? "text-text-muted" : "text-text-2"}>{row.a}</span>
                  <span className="font-semibold text-accent">{row.b}</span>
                  <span className="text-text-2">{row.c}</span>
                </div>
              ))}
            </div>
          </div>
          <span className="text-[12px] text-text-muted">
            * Personal: R$ 69,90/mês nos 3 primeiros meses, depois R$ 129,90/mês. Todos os planos têm 15 dias de
            experimentação, sem adesão.
          </span>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-28 flex max-w-[900px] flex-col gap-7 px-6 sm:px-10">
          <h2 className="m-0 text-center font-display text-[36px] font-black uppercase sm:text-[48px]">Perguntas frequentes</h2>
          <Faq />
        </section>

        {/* CONTATO / CTA */}
        <section id="contato" className="mx-auto mt-28 max-w-[1180px] px-6 sm:px-10">
          <div className="relative grid items-center gap-12 overflow-hidden rounded-lg border border-accent bg-surface p-8 sm:p-14 lg:grid-cols-[1.2fr_1fr]">
            <div
              className="absolute inset-x-0 top-0 h-[5px]"
              style={{
                background: "repeating-linear-gradient(-45deg, var(--bb-pole-red) 0 10px, var(--bb-pole-white) 10px 20px, var(--bb-pole-blue) 20px 30px)",
              }}
            />
            <div className="flex flex-col gap-4">
              <h2 className="m-0 font-display text-[38px] font-black uppercase leading-[0.98] sm:text-[52px]">
                Pronto para
                <br />
                encher a agenda?
              </h2>
              <p className="m-0 max-w-[460px] text-[16px] leading-[1.55] text-text-2">
                Comece o teste de 15 dias agora ou fale com um especialista — a gente configura a sua barbearia junto com
                você.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-3">
                <a
                  href={salesWaLink(WA_MESSAGES.trial)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-accent px-[30px] py-[15px] text-[15px] font-bold text-text-inverse transition-colors hover:bg-accent-hover"
                >
                  Começar teste grátis
                </a>
                <a
                  href={salesWaLink(WA_MESSAGES.specialist)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md px-[26px] py-[15px] text-[15px] font-semibold"
                  style={{ border: "1px solid #25D366", color: "#25D366" }}
                >
                  <Icon name="message-circle" size={17} />
                  WhatsApp
                </a>
              </div>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="mt-24 border-t border-border bg-surface">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-12 sm:grid-cols-2 sm:px-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-display text-[16px] font-black text-text-inverse">
                B✦
              </span>
              <span className="font-display text-[18px] font-extrabold uppercase tracking-[0.04em]">barberagencia</span>
            </div>
            <p className="m-0 max-w-[280px] text-[13px] leading-[1.55] text-text-muted">
              Plataforma white-label de agendamento, assinaturas e gestão para barbearias.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title} className="flex flex-col gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{col.title}</span>
              {col.links.map((l) =>
                l.href.startsWith("#") ? (
                  <a key={l.label} href={l.href} className="text-[13px] text-text-2 transition-colors hover:text-accent">
                    {l.label}
                  </a>
                ) : (
                  <Link key={l.label} href={l.href} className="text-[13px] text-text-2 transition-colors hover:text-accent">
                    {l.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center border-t border-border-subtle px-6 py-5 text-center text-[12px] text-text-muted sm:px-10">
          © 2026 barberagencia · Todos os direitos reservados
        </div>
      </footer>
    </div>
  );
}
