import type { Metadata } from "next";
import Image from "next/image";
import { LandingHeader } from "@/features/landing/components/landing-header";
import { LandingFooter } from "@/features/landing/components/landing-footer";
import { LandingJsonLd } from "@/features/seo/landing-json-ld";
import { LANDING_SEO_METADATA } from "@/features/seo/site";
import { DeviceShowcase } from "@/features/landing/components/device-showcase";
import { Faq } from "@/features/landing/components/faq";
import { Icon } from "@/features/landing/components/icon";
import { LandingMotion } from "@/features/landing/components/landing-motion";
import { Beams } from "@/features/landing/components/beams";
import { AgendaMock, PlanMock, QueueVisual, TurnMock } from "@/features/landing/components/landing-mocks";
import "@/features/landing/landing-v2.css";
import {
  AFTER,
  BEFORE,
  CLIENT_APP_IMAGE,
  CLIENT_FEATURES,
  METRICS,
  OFFER_PERKS,
  PLAN_TABLE,
  PLANS,
  QUEUE_STEPS,
  SECTORS,
  STEPS,
  salesWaLink,
  WA_MESSAGES,
} from "@/features/landing/content";

export const metadata: Metadata = {
  ...LANDING_SEO_METADATA,
  title: "Barber Agência — a barbearia inteira em uma plataforma",
  description:
    "Plataforma white-label para barbearias: agenda online, fila por QR code com painel na TV, mensalidade com saldo de cortes, comanda e financeiro por barbeiro. Sem adesão e sem custo de setup.",
};

const H2 = "font-display font-black uppercase leading-[0.98] text-[40px] sm:text-[52px] lg:text-[56px]";
const OVERLINE = "text-[12px] font-semibold uppercase tracking-[0.12em] text-accent";
/** Atraso da entrada em cascata (data-reveal). */
const delay = (i: number) => ({ ["--d" as string]: i });

export default function LandingPage() {
  return (
    <div id="landing" className="min-h-screen overflow-x-clip bg-bg text-text" style={{ fontFamily: "var(--bb-font-ui)" }}>
      <LandingMotion rootId="landing" />
      <LandingHeader />
      <LandingJsonLd />

      <main>
        {/* HERO */}
        <section id="produto" className="relative -mt-[72px] overflow-hidden px-6 pt-[120px] sm:px-10 sm:pt-[150px]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 55% 45% at 50% -5%, var(--bb-accent-wash), transparent 70%)" }}
          />
          <div className="lv2-grid" />
          <div className="lv2-grain" />
          <div className="relative mx-auto flex max-w-[1180px] flex-col items-center gap-6 text-center">
            <div className="inline-flex items-center gap-2.5 rounded-pill border border-border bg-surface px-4 py-1.5 text-[13px] text-text-2">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--bb-success)" }} />
              <strong className="font-bold text-accent">Promoção de fim de ano</strong> · 2 primeiros meses a partir de R$ 69,90
            </div>
            <h1 className="m-0 max-w-[900px] font-display text-[46px] font-black uppercase leading-[0.92] tracking-[0.01em] sm:text-[68px] lg:text-[86px]">
              A barbearia inteira
              <br />
              em <span className="lv2-grad">uma plataforma</span>
            </h1>
            <p className="m-0 max-w-[620px] text-[17px] leading-[1.55] text-text-2 sm:text-[18px]">
              A Barber Agência é o sistema da barbearia com a sua marca: agenda online, fila por QR code com painel na
              TV, mensalidade com saldo de cortes, comanda e financeiro por barbeiro. Seu cliente agenda pelo link, sem
              baixar aplicativo; você acompanha tudo em tempo real.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={salesWaLink(WA_MESSAGES.start)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-pill bg-accent px-[30px] py-[15px] text-[15px] font-bold text-text-inverse shadow-lg transition-colors hover:bg-accent-hover"
              >
                Começar agora
              </a>
              <a
                href={salesWaLink(WA_MESSAGES.start)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-pill border border-border px-[26px] py-[15px] text-[15px] font-semibold text-text transition-colors hover:border-accent hover:text-accent"
              >
                <Icon name="phone" size={16} />
                Falar com um especialista
              </a>
            </div>
            <div className="flex flex-wrap justify-center gap-x-7 gap-y-2 text-[13px] text-text-muted">
              {["Sem custo de migração", "Sem custo de adesão e setup", "Barbearia montada em 1 dia"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Icon name="check" size={15} className="text-[color:var(--bb-success)]" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Palco do produto: mock em perspectiva que endireita no scroll + cartões flutuantes (fictícios) */}
          <div className="relative mx-auto max-w-[1180px]">
            <Beams className="-top-10 bottom-20 [mask-image:linear-gradient(to_bottom,transparent,#000_30%,#000_70%,transparent)]" />
            <div className="lv2-tilt relative" data-scroll>
              <div>
                <DeviceShowcase />
              </div>
            </div>
            <AgendaMock className="lv2-bob absolute -left-6 top-[30%] hidden xl:block" />
            <TurnMock className="lv2-bob absolute -right-4 top-[22%] hidden xl:block [--d:1]" />
            <PlanMock className="lv2-bob absolute -right-10 bottom-[18%] hidden xl:block [--d:2]" />
          </div>
        </section>

        {/* MÉTRICAS + BENEFÍCIOS — painel escuro */}
        <div data-theme="dark" data-header-tone="dark" className="lv2-panel mx-3 mt-[88px] pb-20 pt-16 text-text sm:mx-5 sm:pb-24 sm:pt-20">
          <div className="lv2-glow" />
          <div className="lv2-grid" />
          <div className="lv2-grain" />
        <section className="relative mx-auto max-w-[1180px] px-5 sm:px-10">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {METRICS.map((m, i) => (
              <div key={m.label} data-reveal style={delay(i)} className="lv2-card flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                <span className="lv2-grad font-display text-[40px] font-black leading-none">{m.value}</span>
                <span className="text-[13px] leading-[1.4] text-text-2">{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* BENEFÍCIOS */}
        <section id="beneficios" className="relative mx-auto mt-24 flex max-w-[1180px] scroll-mt-24 flex-col gap-10 px-5 sm:px-10">
          <div data-reveal className="flex max-w-[680px] flex-col gap-3">
            <span className={OVERLINE}>Tudo o que você ganha</span>
            <h2 className={`m-0 ${H2}`}>
              Um setor de cada vez,
              <br />
              todos no mesmo painel
            </h2>
            <p className="m-0 text-[16px] leading-[1.55] text-text-2">
              Não é só agenda: a Barber Agência cuida da operação inteira da barbearia, do pedido de horário do cliente ao
              fechamento do caixa, com o faturamento separado por barbeiro, por dia e por serviço.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {SECTORS.map((s, i) => (
              <div key={s.title} data-reveal style={delay(i % 3)} className="lv2-card flex flex-col gap-3.5 p-7">
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
        </div>

        {/* ANTES / DEPOIS */}
        <section className="mx-auto mt-28 flex max-w-[1180px] flex-col gap-8 px-6 sm:px-10">
          <div data-reveal className="flex max-w-[640px] flex-col gap-3">
            <span className={OVERLINE}>O que muda de verdade</span>
            <h2 className={`m-0 ${H2}`}>
              Do caderno
              <br />
              ao piloto automático
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div data-reveal className="flex flex-col gap-4 rounded-[28px] border border-border bg-surface p-7">
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
            {/* "Digitando": o texto já está no HTML; o efeito só revela da esquerda para a direita. */}
            <div
              data-type
              style={{ ["--n" as string]: AFTER.length }}
              className="lv2-card flex flex-col gap-4 border-2 !border-accent p-7 shadow-lg"
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-success-bg">
                  <Icon name="check" size={17} className="text-[color:var(--bb-success)]" />
                </span>
                <span className="text-[17px] font-semibold">Com a Barber Agência</span>
              </div>
              {AFTER.map((t, i) => (
                <div key={t} className="flex items-start gap-2.5 text-[14px] leading-[1.5] text-text">
                  <Icon name="check" size={15} className="mt-[3px] shrink-0 text-[color:var(--bb-success)]" />
                  <span data-type-line className="inline-block" style={delay(i)}>
                    {t}
                    {i === AFTER.length - 1 && <span className="lv2-caret" aria-hidden="true" />}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* APP DO CLIENTE */}
        <section id="cliente" className="mx-auto mt-28 max-w-[1180px] px-6 sm:px-10">
          <div className="grid items-start gap-14 lg:grid-cols-[1fr_380px]">
            <div data-reveal className="flex flex-col gap-4.5 lg:py-10" style={{ gap: 18 }}>
              <span className={OVERLINE}>A visão do seu cliente</span>
              <h2 className={`m-0 ${H2}`}>
                Ele agenda sozinho,
                <br />
                com a sua marca
              </h2>
              <p className="m-0 max-w-[520px] text-[16px] leading-[1.6] text-text-2">
                Seu cliente abre o link da <strong className="text-text">sua</strong> barbearia no celular, sem baixar
                nada, e vê o seu logo e as suas cores. Escolhe barbeiro, serviços e horário, assina um combo mensal e
                acompanha o saldo de cortes. Você confirma em até 10 minutos.
              </p>
              <div className="mt-1 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {CLIENT_FEATURES.map((c, i) => (
                  <div
                    key={c.title}
                    data-reveal
                    style={delay(i)}
                    className="lv2-card flex items-start gap-2.5 !rounded-[20px] p-4 text-[14px] leading-[1.45]"
                  >
                    <Icon name={c.icon} size={17} className="mt-0.5 shrink-0 text-accent" />
                    <div>
                      <div className="font-semibold">{c.title}</div>
                      <div className="text-[13px] text-text-muted">{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center lg:sticky lg:top-24">
              <div className="relative flex w-[300px] max-w-full sm:w-[320px]">
                <PlanMock className="lv2-bob absolute -left-24 bottom-[14%] z-[3] hidden lg:block" />
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

        {/* FILA DE ATENDIMENTO — jornada com scroll travado (md+); no celular, lista empilhada */}
        <section
          id="fila"
          data-theme="dark"
          data-header-tone="dark"
          data-steps={QUEUE_STEPS.length}
          data-step="0"
          style={{ ["--steps" as string]: QUEUE_STEPS.length }}
          className="lv2-journey relative mt-28 bg-[#0a0a09] text-text"
        >
          <div className="lv2-journey-stage overflow-hidden py-20">
            <div className="lv2-grid" />
            <div className="lv2-glow" />
            <div className="relative mx-auto grid w-full max-w-[1180px] items-center gap-12 px-6 sm:px-10 md:grid-cols-2">
              <div className="flex flex-col gap-6">
                <div data-reveal className="flex max-w-[560px] flex-col gap-3">
                  <span className={OVERLINE}>Fila de atendimento · Essencial e Advance</span>
                  <h2 className={`m-0 ${H2}`}>
                    Fila com senha,
                    <br />
                    sem bagunça no balcão
                  </h2>
                  <p className="m-0 text-[16px] leading-[1.55] text-text-2">
                    Para quem atende por ordem de chegada: o cliente entra na fila sozinho, pega a senha como no banco e
                    acompanha a vez dele, sem ficar perguntando no balcão.
                  </p>
                </div>
                <div aria-hidden="true" className="lv2-journey-dots hidden gap-2">
                  {QUEUE_STEPS.map((q) => (
                    <span key={q.title} className="lv2-journey-dot h-1.5 w-3 rounded-full bg-border" />
                  ))}
                </div>
                <ol className="lv2-journey-steps m-0 list-none p-0">
                  {QUEUE_STEPS.map((q, i) => (
                    <li key={q.title} className="lv2-journey-step lv2-card flex flex-col gap-3.5 p-7">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-accent-wash text-accent">
                          <Icon name={q.icon} size={22} />
                        </span>
                        <span className="font-display text-[30px] font-black leading-none text-text-muted">0{i + 1}</span>
                      </div>
                      <h3 className="m-0 text-[18px] font-semibold">{q.title}</h3>
                      <p className="m-0 text-[14px] leading-[1.55] text-text-2">{q.desc}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="lv2-journey-visual">
                {([0, 1, 2] as const).map((i) => (
                  <div key={i} data-visual={i}>
                    <QueueVisual step={i} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section className="mx-auto mt-28 flex max-w-[1180px] flex-col gap-9 px-6 sm:px-10">
          <div data-reveal className="flex max-w-[620px] flex-col gap-3">
            <span className={OVERLINE}>Implantação</span>
            <h2 className={`m-0 ${H2}`}>No ar em 4 passos</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((st, i) => (
              <div
                key={st.num}
                data-reveal
                style={delay(i)}
                className={`lv2-card flex flex-col gap-3 overflow-hidden p-6 ${st.strong ? "!border-accent" : ""}`}
              >
                {st.strong && <Beams at={[18, 52, 84]} />}
                <span className="relative font-display text-[30px] font-black leading-none text-accent">{st.num}</span>
                <div className="relative text-[16px] font-semibold">{st.title}</div>
                <p className="relative m-0 text-[14px] leading-[1.5] text-text-2">{st.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PLANOS */}
        <section id="planos" className="mx-auto mt-28 flex max-w-[1180px] flex-col gap-9 px-6 sm:px-10">
          <div data-reveal className="flex flex-col items-center gap-3.5 text-center">
            <span className={OVERLINE}>Planos</span>
            <h2 className="m-0 font-display text-[40px] font-black uppercase leading-[0.98] sm:text-[54px] lg:text-[60px]">
              Escolha o plano da
              <br />
              sua barbearia
            </h2>
            <p className="m-0 max-w-[600px] text-[15px] leading-[1.55] text-text-2">
              <strong className="font-bold text-accent">Promoção de fim de ano:</strong> Personal e Essencial com preço
              promocional nos 2 primeiros meses. Sem adesão · cancelamento livre.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {OFFER_PERKS.map((p, i) => (
              <div
                key={p.title}
                data-reveal
                style={delay(i)}
                className="flex items-start gap-3.5 rounded-[24px] border border-accent bg-accent-wash p-5"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-text-inverse">
                  <Icon name={p.icon} size={20} />
                </span>
                <div className="flex flex-col gap-1">
                  <div className="text-[16px] font-bold text-text">{p.title}</div>
                  <p className="m-0 text-[13px] leading-[1.5] text-text-2">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid items-stretch gap-5 pt-3 md:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((pl, i) => (
              <div
                key={pl.name}
                data-reveal
                style={{
                  ...delay(i),
                  ...(pl.highlight
                    ? {
                        border: "2px solid var(--bb-accent)",
                        boxShadow: "inset 0 1px 0 0 rgba(255,255,255,.08), 0 40px 80px -36px color-mix(in srgb, var(--bb-gold-500) 45%, transparent)",
                      }
                    : {}),
                }}
                className="lv2-card flex flex-col gap-4 p-[30px]"
              >
                {pl.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill bg-accent px-4 py-1 text-[11px] font-bold text-text-inverse">
                    Mais popular
                  </span>
                )}
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-[30px] font-extrabold uppercase">{pl.name}</div>
                  {pl.discountBadge && (
                    <span className="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 font-display text-[20px] font-black leading-none text-text-inverse shadow-lg">
                      {pl.discountBadge}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  {pl.fullPrice && (
                    <span className="text-[15px] font-semibold text-text-muted line-through">{pl.fullPrice}</span>
                  )}
                  <span className="font-display text-[46px] font-black leading-none text-accent">{pl.price}</span>
                  <span className="text-[12px] text-text-muted">{pl.cycle}</span>
                </div>
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
                  href={salesWaLink(WA_MESSAGES.start)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-pill py-3.5 text-center text-[14px] font-bold transition-opacity hover:opacity-90"
                  style={{
                    border: pl.highlight ? "none" : "1px solid var(--bb-accent)",
                    background: pl.highlight ? "var(--bb-accent)" : "transparent",
                    color: pl.highlight ? "var(--bb-text-inverse)" : "var(--bb-accent)",
                  }}
                >
                  Começar agora
                </a>
              </div>
            ))}
          </div>

          {/* Tabela comparativa */}
          <div data-reveal className="mt-4 overflow-x-auto rounded-[24px] border border-border bg-surface">
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
            * Promoção de fim de ano: Personal R$ 69,90/mês nos 2 primeiros meses, depois R$ 129,90/mês. Essencial R$ 89,90/mês
            nos 2 primeiros meses, depois R$ 189,90/mês. Advance sem promoção. Sem custo de adesão, setup ou migração.
          </span>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-28 flex max-w-[900px] flex-col gap-7 px-6 sm:px-10">
          <h2 data-reveal className="m-0 text-center font-display text-[36px] font-black uppercase sm:text-[48px]">
            Perguntas frequentes
          </h2>
          <Faq />
        </section>

        {/* CONTATO / CTA */}
        <section id="contato" className="mx-auto mt-28 max-w-[1180px] px-6 sm:px-10">
          <div data-theme="dark" data-header-tone="dark" className="lv2-panel flex flex-col gap-4 p-8 text-text sm:p-14">
            <div className="lv2-glow" />
            <div className="lv2-grain" />
            <Beams />
            <div
              className="absolute inset-x-0 top-0 h-[5px]"
              style={{
                background: "repeating-linear-gradient(-45deg, var(--bb-pole-red) 0 10px, var(--bb-pole-white) 10px 20px, var(--bb-pole-blue) 20px 30px)",
              }}
            />
            <div data-reveal className="relative flex flex-col items-center gap-4 text-center">
              <h2 className="m-0 font-display text-[38px] font-black uppercase leading-[0.98] sm:text-[52px]">
                Pronto para
                <br />
                <span className="lv2-grad">encher a agenda?</span>
              </h2>
              <p className="m-0 max-w-[460px] text-[16px] leading-[1.55] text-text-2">
                Comece agora — a gente monta a sua barbearia em 1 dia e traz a sua base, sem custo.{" "}
                <strong className="font-bold text-accent">Promoção de fim de ano:</strong> Personal R$ 69,90 e Essencial
                R$ 89,90 nos 2 primeiros meses.
              </p>
              <div className="mt-1.5 flex flex-wrap justify-center gap-3">
                <a
                  href={salesWaLink(WA_MESSAGES.start)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-pill bg-accent px-[30px] py-[15px] text-[15px] font-bold text-text-inverse transition-colors hover:bg-accent-hover"
                >
                  Começar agora
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter bigMark />
    </div>
  );
}
