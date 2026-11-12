import type { Metadata } from "next";
import { Minus, Plus } from "lucide-react";
import { LandingHeader } from "@/features/landing/components/landing-header";
import { LandingFooter } from "@/features/landing/components/landing-footer";
import { DistributorLeadForm } from "@/features/landing/components/distributor-lead-form";
import { Icon } from "@/features/landing/components/icon";
import { salesWaLink, WA_MESSAGES } from "@/features/landing/content";
import { DIST_FAQS, DIST_FEATURES, DIST_STEPS } from "@/features/landing/distributor-content";
import { DISTRIBUTOR_SEO_METADATA } from "@/features/seo/site";
import { LEAD_PRIVACY_HREF } from "@/features/leads/consent";

export const metadata: Metadata = DISTRIBUTOR_SEO_METADATA;

const H2 = "m-0 font-display font-black uppercase leading-[0.98] text-[34px] sm:text-[48px]";
const OVERLINE = "text-[12px] font-semibold uppercase tracking-[0.12em] text-accent";

/** Página pública "Para distribuidoras" (#83). Sem preço e sem "transportadora" até as decisões D1/D2/D3. */
export default function DistribuidorasPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg text-text" style={{ fontFamily: "var(--bb-font-ui)" }}>
      <LandingHeader anchorBase="/" ctaMessage={WA_MESSAGES.distributor} />

      <main>
        {/* HERO */}
        <section id="topo" className="relative overflow-hidden px-5 pt-14 sm:px-10 sm:pt-[88px]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 55% 45% at 50% -5%, var(--bb-accent-wash), transparent 70%)" }}
          />
          <div className="relative mx-auto flex max-w-[1000px] flex-col items-center gap-6 text-center">
            <span className="inline-flex items-center gap-2.5 rounded-pill border border-border bg-surface px-4 py-1.5 text-[13px] font-semibold text-accent">
              Para distribuidoras
            </span>
            <h1 className="m-0 max-w-[900px] font-display text-[40px] font-black uppercase leading-[0.95] tracking-[0.01em] sm:text-[60px] lg:text-[72px]">
              Seus clientes, seu catálogo e seus pedidos <span className="text-accent">num lugar só.</span>
            </h1>
            <p className="m-0 max-w-[640px] text-[17px] leading-[1.55] text-text-2 sm:text-[18px]">
              A Barber Agência já organiza a barbearia. Agora organiza quem vende para ela: distribuidoras e revendedores
              de pomada, produtos de barba e máquinas.
            </p>
            <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <a
                href="#cadastro"
                className="rounded-md bg-accent px-[26px] py-[15px] text-center text-[15px] font-bold text-text-inverse shadow-lg transition-colors hover:bg-accent-hover"
              >
                Quero cadastrar minha distribuidora
              </a>
              <a
                href={salesWaLink(WA_MESSAGES.distributor)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-[26px] py-[15px] text-[15px] font-semibold text-text transition-colors hover:border-accent hover:text-accent"
              >
                <Icon name="message-circle" size={16} />
                Chamar no WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* O QUE VOCÊ CONTROLA */}
        <section className="mx-auto mt-24 flex max-w-[1180px] flex-col gap-10 px-5 sm:px-10">
          <div className="flex max-w-[680px] flex-col gap-3">
            <span className={OVERLINE}>O que você controla</span>
            <h2 className={H2}>Tudo da distribuidora no mesmo painel</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DIST_FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-6 transition-colors hover:border-accent hover:shadow-md"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-accent-wash text-accent">
                  <Icon name={f.icon} size={22} />
                </span>
                <h3 className="m-0 text-[18px] font-semibold">{f.title}</h3>
                <p className="m-0 text-[14px] leading-[1.55] text-text-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section className="mx-auto mt-24 flex max-w-[1180px] flex-col gap-10 px-5 sm:px-10">
          <div className="flex max-w-[680px] flex-col gap-3">
            <span className={OVERLINE}>Como funciona</span>
            <h2 className={H2}>Três passos</h2>
          </div>
          <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
            {DIST_STEPS.map((s) => (
              <li key={s.num} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
                <span className="font-display text-[40px] font-black leading-none text-accent">{s.num}</span>
                <p className="m-0 text-[16px] leading-[1.5] text-text">{s.title}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* BOM PARA OS DOIS LADOS */}
        <section className="mx-auto mt-24 max-w-[1180px] px-5 sm:px-10">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 sm:p-10">
            <span className={OVERLINE}>Bom para os dois lados</span>
            <p className="m-0 max-w-[760px] text-[18px] leading-[1.6] text-text sm:text-[20px]">
              Barbearia que usa a Barber Agência faz o pedido no mesmo painel onde cuida da agenda e do caixa. Você indica
              as suas barbearias e recebe os pedidos organizados.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-24 flex max-w-[900px] flex-col gap-7 px-5 sm:px-10">
          <h2 className={`${H2} text-center`}>Perguntas frequentes</h2>
          <div className="flex flex-col gap-2.5">
            {DIST_FAQS.map((f, i) => (
              <details
                key={f.q}
                open={i === 0}
                className="group rounded-md border border-border bg-surface transition-colors open:border-accent hover:border-accent"
              >
                <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-4 px-5 py-[18px] text-left [&::-webkit-details-marker]:hidden">
                  <h3 className="m-0 text-[15px] font-semibold text-text">{f.q}</h3>
                  <Plus size={18} className="shrink-0 text-accent group-open:hidden" aria-hidden />
                  <Minus size={18} className="hidden shrink-0 text-accent group-open:block" aria-hidden />
                </summary>
                <p className="m-0 px-5 pb-[18px] text-[14px] leading-[1.6] text-text-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CADASTRO / FECHAMENTO */}
        <section id="cadastro" className="mx-auto mt-24 max-w-[1180px] scroll-mt-20 px-5 sm:px-10">
          <div className="relative grid gap-8 overflow-hidden rounded-lg border border-accent bg-surface p-5 pt-8 sm:p-10 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-14 lg:p-14">
            <div
              className="absolute inset-x-0 top-0 h-[5px]"
              style={{
                background:
                  "repeating-linear-gradient(-45deg, var(--bb-pole-red) 0 10px, var(--bb-pole-white) 10px 20px, var(--bb-pole-blue) 20px 30px)",
              }}
            />
            <div className="flex flex-col gap-4">
              <h2 className={H2}>
                Quer ver
                <br />
                por dentro?
              </h2>
              <p className="m-0 max-w-[460px] text-[16px] leading-[1.55] text-text-2">
                Chama no WhatsApp e marca uma conversa com o Diego, dono da Barber Agência. Ou deixa os seus dados aqui
                que a gente te chama.
              </p>
            </div>
            <DistributorLeadForm />
          </div>
        </section>
      </main>

      <LandingFooter anchorBase="/" privacyHref={LEAD_PRIVACY_HREF} />
    </div>
  );
}
