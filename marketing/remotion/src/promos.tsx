import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C, DISPLAY, UI, Bg, Logo, Pill, QR, PhoneTicket, COMMENT_CTA } from "./brand";

export const FPS = 30;
export const PROMO_DUR = 30 * FPS; // 30s

/* Entrada suave (fade + subida) para o conteúdo da cena. */
const Enter: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const opacity = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ opacity, transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)` }}>{children}</div>;
};

const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: UI }}>
    <Bg />
    <div style={{ position: "absolute", inset: 0, padding: "150px 96px", display: "flex", flexDirection: "column" }}>
      <Logo />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 34 }}>{children}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 30, color: C.accent }}>{COMMENT_CTA}</div>
    </div>
    <div style={{ position: "absolute", inset: 28, border: `2px solid rgba(201,162,75,0.28)`, borderRadius: 40, pointerEvents: "none" }} />
  </AbsoluteFill>
);

const Kick: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: DISPLAY, fontSize: 36, letterSpacing: 3, color: C.accent, textTransform: "uppercase" }}>{children}</div>
);
const Big: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 128 }) => (
  <h1 style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 0.95, color: C.text, textTransform: "uppercase", margin: 0 }}>{children}</h1>
);
const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: UI, fontSize: 46, color: C.muted, maxWidth: 840 }}>{children}</div>
);
const hl = (t: string) => <span style={{ color: C.accent }}>{t}</span>;

type SceneDef = { d: number; node: React.ReactNode };
const Reel: React.FC<{ scenes: SceneDef[] }> = ({ scenes }) => {
  let from = 0;
  return (
    <AbsoluteFill>
      {scenes.map((s, i) => {
        const el = (
          <Sequence key={i} from={from} durationInFrames={s.d}>
            <Stage>
              <Enter>{s.node}</Enter>
            </Stage>
          </Sequence>
        );
        from += s.d;
        return el;
      })}
    </AbsoluteFill>
  );
};

/* ===================== PROMO 1 — Agenda + Fila ===================== */
export const PROMO_1: React.FC = () => (
  <Reel
    scenes={[
      { d: 150, node: (<><Kick>Dono de barbearia</Kick><Big>Lotada e mesmo assim {hl("sobra cadeira vazia")}?</Big></>) },
      { d: 150, node: (<><Kick>Problema 01</Kick><Big size={120}>Agenda no WhatsApp = horário que {hl("some")}</Big></>) },
      { d: 150, node: (<><Kick>Problema 02</Kick><Big size={120}>Fila no grito = cliente que {hl("vai embora")}</Big></>) },
      { d: 180, node: (<><Kick>A solução</Kick><Big size={112}>Agenda + fila num {hl("painel só")}</Big>
        <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 20 }}><QR size={200} /><div style={{ fontFamily: DISPLAY, fontSize: 80, color: C.accent }}>→</div><PhoneTicket senha="A12" /></div></>) },
      { d: 120, node: (<><Kick>Tudo num lugar</Kick><Big size={104}>Agendamento · Fila por QR · App do cliente · {hl("Relatórios")}</Big></>) },
      { d: 150, node: (<><Big size={132}>Teste {hl("15 dias grátis")}</Big><Sub>A gente monta sua agenda e a fila na 1ª semana.</Sub><div style={{ marginTop: 24 }}><Pill solid>Comenta "QUERO"</Pill></div></>) },
    ]}
  />
);

/* ===================== PROMO 2 — Plano + App white-label ===================== */
export const PROMO_2: React.FC = () => (
  <Reel
    scenes={[
      { d: 150, node: (<><Kick>Receita previsível</Kick><Big>Chega de depender só do {hl("movimento")}</Big></>) },
      { d: 160, node: (<><Kick>Clube do corte</Kick><Big size={118}>Mensalidade fixa. Cliente que {hl("volta sempre")}.</Big></>) },
      { d: 170, node: (<><Kick>No automático</Kick><Big size={118}>O app dá baixa no {hl("saldo de cortes")} sozinho</Big>
        <div style={{ marginTop: 24 }}><PhoneTicket senha="✓" /></div></>) },
      { d: 150, node: (<><Kick>White-label</Kick><Big size={126}>Seu cliente agenda no {hl("SEU")} app</Big><Sub>Com a sua marca e a sua logo. Não é da gente, é seu.</Sub></>) },
      { d: 120, node: (<><Kick>Planos</Kick><Big size={116}>A partir de {hl("R$ 69,90/mês")}</Big><Sub>Personal, Essencial e Advance.</Sub></>) },
      { d: 150, node: (<><Big size={132}>Comece {hl("grátis")} hoje</Big><Sub>15 dias pra testar com a marca da sua barbearia.</Sub><div style={{ marginTop: 24 }}><Pill solid>Comenta "QUERO"</Pill></div></>) },
    ]}
  />
);
