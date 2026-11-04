import React from "react";
import { AbsoluteFill } from "remotion";
import { C, UI, DISPLAY, PAD, Bg, Logo, Divider, Kicker, Title, Body, Dots, Pill, QR, PhoneTicket, RisingBars, BrowserMock, PhoneApp, COMMENT_CTA } from "./brand";

/* ---- Layout unificado (grid consistente: header · conteúdo · rodapé) ---- */
const Board: React.FC<{ story?: boolean; footer: React.ReactNode; children: React.ReactNode }> = ({ story, footer, children }) => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: UI }}>
    <Bg />
    <div style={{ position: "absolute", inset: 0, padding: story ? `${PAD + 40}px ${PAD}px` : PAD, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
        <Logo />
        <Divider />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 32 }}>{children}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
        <Divider />
        {footer}
      </div>
    </div>
  </AbsoluteFill>
);

const CtaFooter: React.FC<{ cta?: string }> = ({ cta = "15 dias grátis" }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <Pill solid>{cta}</Pill>
    <div style={{ fontFamily: DISPLAY, fontSize: 30, color: C.accent, letterSpacing: 0.5 }}>{COMMENT_CTA}</div>
  </div>
);
const DotsFooter: React.FC<{ i: number; total: number; hint?: string }> = ({ i, total, hint }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <Dots i={i} total={total} />
    {hint && <div style={{ fontFamily: UI, fontSize: 28, color: C.muted }}>{hint}</div>}
  </div>
);

/* ========================= CARROSSEL 1 — AGENDA ========================= */
export const C1S1: React.FC = () => (
  <Board footer={<DotsFooter i={0} total={4} hint="arrasta →" />}>
    <Kicker>Gestão de barbearia</Kicker>
    <Title size={90} parts={[{ t: "Sua agenda tá te fazendo " }, { t: "perder dinheiro", hl: true }, { t: "?" }]} />
    <Body>3 sinais de que o WhatsApp na mão está custando cadeira vazia.</Body>
  </Board>
);
const NumberSlide: React.FC<{ n: string; title: React.ReactNode; body: string; i: number }> = ({ n, title, body, i }) => (
  <Board footer={<DotsFooter i={i} total={4} />}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 34 }}>
      <div style={{ fontFamily: "'Arial Black', Impact, sans-serif", fontSize: 150, color: C.accent, lineHeight: 0.8 }}>{n}</div>
      <div style={{ paddingTop: 8 }}>
        <h2 style={{ fontFamily: "'Arial Black', Impact, sans-serif", fontSize: 78, lineHeight: 1.0, color: C.text, textTransform: "uppercase", margin: 0 }}>{title}</h2>
      </div>
    </div>
    <Body>{body}</Body>
  </Board>
);
export const C1S2: React.FC = () => <NumberSlide n="01" i={1} title={<>Horário esquecido<br />no WhatsApp</>} body="Some no meio da conversa. Você atende menos do que poderia." />;
export const C1S3: React.FC = () => <NumberSlide n="02" i={2} title={<>Cliente que<br />desistiu da fila</>} body="Sem senha organizada, quem chega e vê tumulto vai embora." />;
export const C1S4: React.FC = () => (
  <Board footer={<CtaFooter />}>
    <Kicker>A solução</Kicker>
    <Title size={88} parts={[{ t: "Agenda " }, { t: "+ fila", hl: true }, { t: " num painel só" }]} />
    <Body>Agendamento online, fila por QR e app do cliente — com a marca da sua barbearia.</Body>
  </Board>
);

/* ========================= CARROSSEL 2 — PLANO ========================= */
export const C2S1: React.FC = () => (
  <Board footer={<DotsFooter i={0} total={3} hint="arrasta →" />}>
    <Kicker>Receita recorrente</Kicker>
    <Title size={86} parts={[{ t: "Transforme corte avulso em " }, { t: "receita todo mês", hl: true }]} />
    <Body>O modelo que as barbearias que mais crescem já usam.</Body>
  </Board>
);
export const C2S2: React.FC = () => (
  <Board footer={<DotsFooter i={1} total={3} />}>
    <Kicker>Clube do corte</Kicker>
    <Title size={88} parts={[{ t: "Mensalidade fixa, cliente " }, { t: "fiel", hl: true }]} />
    <Body>Ele paga todo mês e volta sempre. Você para de depender só do movimento.</Body>
  </Board>
);
export const C2S3: React.FC = () => (
  <Board footer={<CtaFooter />}>
    <Kicker>No automático</Kicker>
    <Title size={88} parts={[{ t: "O app controla o " }, { t: "saldo de cortes", hl: true }]} />
    <Body>Cada corte usado dá baixa sozinho. Zero caderninho, zero confusão.</Body>
  </Board>
);

/* ========================= POST — PROVA SOCIAL ========================= */
export const POST: React.FC = () => (
  <Board footer={<CtaFooter cta="Barber Agência" />}>
    <Title size={96} parts={[{ t: "Barbearia organizada " }, { t: "fatura mais", hl: true }, { t: "." }]} />
    <div style={{ marginTop: 10 }}>
      <RisingBars />
    </div>
  </Board>
);

/* ========================= MOCKUPS DA PLATAFORMA ========================= */
export const PLATFORM: React.FC = () => (
  <Board footer={<CtaFooter />}>
    <Kicker>A plataforma</Kicker>
    <Title size={84} parts={[{ t: "Tudo num " }, { t: "painel só", hl: true }]} />
    <div style={{ marginTop: 10 }}>
      <BrowserMock />
    </div>
  </Board>
);
export const RESPONSIVE: React.FC = () => (
  <Board story footer={<CtaFooter />}>
    <Kicker>Responsivo</Kicker>
    <Title size={92} parts={[{ t: "Funciona em " }, { t: "qualquer tela", hl: true }]} />
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 40, marginTop: 20 }}>
      <BrowserMock w={620} />
      <PhoneApp />
    </div>
  </Board>
);
export const CLIENT_APP: React.FC = () => (
  <Board story footer={<CtaFooter />}>
    <Kicker>App do cliente</Kicker>
    <Title size={96} parts={[{ t: "Seu cliente agenda no " }, { t: "seu", hl: true }, { t: " app" }]} />
    <div style={{ display: "flex", justifyContent: "center", gap: 44, marginTop: 20 }}>
      <PhoneApp />
      <PhoneTicket senha="A12" />
    </div>
  </Board>
);

/* ========================= CAPAS DE REEL (story) ========================= */
export const REEL1_COVER: React.FC = () => (
  <Board story footer={<CtaFooter cta="Chama no direct" />}>
    <Kicker>Fila por QR</Kicker>
    <h1 style={{ fontFamily: "'Arial Black', Impact, sans-serif", fontSize: 116, lineHeight: 0.98, color: C.text, textTransform: "uppercase", margin: 0, letterSpacing: -1.5 }}>
      Fila sem <span style={{ color: C.accent }}>tumulto</span> no balcão
    </h1>
    <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 24 }}>
      <QR size={220} />
      <div style={{ fontFamily: "'Arial Black', Impact, sans-serif", fontSize: 80, color: C.accent }}>→</div>
      <PhoneTicket senha="A12" />
    </div>
  </Board>
);
export const REEL2_COVER: React.FC = () => (
  <Board story footer={<CtaFooter />}>
    <Kicker>App white-label</Kicker>
    <h1 style={{ fontFamily: "'Arial Black', Impact, sans-serif", fontSize: 120, lineHeight: 0.98, color: C.text, textTransform: "uppercase", margin: 0, letterSpacing: -1.5 }}>
      Seu cliente agenda no <span style={{ color: C.accent }}>seu</span> app
    </h1>
    <Body>Com a SUA marca e a SUA logo. Não é da gente — é seu.</Body>
    <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
      <PhoneApp />
    </div>
  </Board>
);
