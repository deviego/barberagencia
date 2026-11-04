import React from "react";
import { Img, staticFile } from "remotion";

/* ---- Tokens da Barber Agência ---- */
export const C = {
  bg: "#0D0D0D",
  bg2: "#171310",
  card: "#161616",
  border: "rgba(255,255,255,0.10)",
  text: "#F5F1E8",
  muted: "#A59D8C",
  accent: "#C9A24B",
  accent2: "#E4C77E",
};
export const DISPLAY = "'Arial Black', 'Archivo Black', Impact, 'Helvetica Neue', sans-serif";
export const UI = "'Helvetica Neue', Arial, sans-serif";
export const COMMENT_CTA = 'Comenta "QUERO" 👇';
export const PAD = 120;

/* ---- Fundo limpo: gradiente suave + brilho dourado no topo + vinheta ---- */
export const Bg: React.FC = () => (
  <>
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${C.bg2} 0%, ${C.bg} 60%)` }} />
    <div
      style={{
        position: "absolute",
        top: -260,
        left: -160,
        width: 900,
        height: 900,
        background: "radial-gradient(circle, rgba(201,162,75,0.18) 0%, rgba(201,162,75,0) 62%)",
      }}
    />
    <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 340px rgba(0,0,0,0.6)" }} />
  </>
);

/* ---- Logo real (emblema circular) ---- */
export const LogoMark: React.FC<{ size?: number }> = ({ size = 110 }) => (
  <Img
    src={staticFile("logo.jpeg")}
    style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }}
  />
);
export const Logo: React.FC<{ size?: number }> = ({ size = 116 }) => <LogoMark size={size} />;

/* ---- Fio horizontal (divisória) ---- */
export const Divider: React.FC = () => <div style={{ height: 1, background: C.border, width: "100%" }} />;

/* ---- Kicker: fio dourado + texto em caixa alta ---- */
export const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
    <div style={{ width: 56, height: 4, background: C.accent, borderRadius: 2 }} />
    <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 30, letterSpacing: 5, color: C.accent, textTransform: "uppercase" }}>{children}</div>
  </div>
);

/* ---- Pill / CTA ---- */
export const Pill: React.FC<{ children: React.ReactNode; solid?: boolean }> = ({ children, solid }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "18px 36px",
      borderRadius: 999,
      fontFamily: DISPLAY,
      fontSize: 32,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      ...(solid ? { background: `linear-gradient(135deg, ${C.accent2}, ${C.accent})`, color: "#171717" } : { border: `2px solid ${C.accent}`, color: C.accent }),
    }}
  >
    {children}
  </div>
);

/* ---- Título com palavra destacada ---- */
export const Title: React.FC<{ parts: { t: string; hl?: boolean }[]; size?: number }> = ({ parts, size = 96 }) => (
  <h1 style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1.0, letterSpacing: -1.5, textTransform: "uppercase", color: C.text, margin: 0 }}>
    {parts.map((p, i) => (
      <span key={i} style={p.hl ? { color: C.accent } : undefined}>
        {p.t}
      </span>
    ))}
  </h1>
);

/* ---- Corpo ---- */
export const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: UI, fontSize: 38, lineHeight: 1.35, color: C.muted, maxWidth: 820 }}>{children}</div>
);

/* ---- Dots de carrossel ---- */
export const Dots: React.FC<{ i: number; total: number }> = ({ i, total }) => (
  <div style={{ display: "flex", gap: 12 }}>
    {Array.from({ length: total }).map((_, k) => (
      <div key={k} style={{ width: k === i ? 40 : 14, height: 14, borderRadius: 999, background: k === i ? C.accent : "rgba(255,255,255,0.22)" }} />
    ))}
  </div>
);

/* ---- QR estilizado (decorativo) ---- */
export const QR: React.FC<{ size?: number }> = ({ size = 220 }) => {
  const on = new Set([
    "0,0","1,0","2,0","0,1","2,1","0,2","1,2","2,2",
    "6,0","7,0","8,0","6,1","8,1","6,2","7,2","8,2",
    "0,6","1,6","2,6","0,7","2,7","0,8","1,8","2,8",
    "4,0","4,2","4,4","6,4","8,4","4,6","4,8","5,5","6,6","7,7","3,4","5,3","7,5","8,7","3,8",
  ]);
  const cell = (size - size * 0.22) / 9;
  return (
    <div style={{ width: size, height: size, background: "#fff", borderRadius: 20, padding: size * 0.11, boxSizing: "border-box" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(9, ${cell}px)`, gridAutoRows: `${cell}px` }}>
        {Array.from({ length: 81 }).map((_, idx) => {
          const x = idx % 9;
          const y = Math.floor(idx / 9);
          return <div key={idx} style={{ background: on.has(`${x},${y}`) ? "#0D0D0D" : "transparent" }} />;
        })}
      </div>
    </div>
  );
};

/* ---- Mock de celular com senha ---- */
export const PhoneTicket: React.FC<{ senha?: string }> = ({ senha = "A12" }) => (
  <div
    style={{
      width: 300,
      height: 580,
      borderRadius: 46,
      background: C.card,
      border: `1px solid ${C.border}`,
      boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    }}
  >
    <div style={{ fontFamily: UI, fontSize: 24, color: C.muted, letterSpacing: 4, textTransform: "uppercase" }}>Sua senha</div>
    <div style={{ fontFamily: DISPLAY, fontSize: 180, color: C.accent, lineHeight: 1 }}>{senha}</div>
    <div style={{ fontFamily: UI, fontSize: 26, color: C.text }}>2 na sua frente</div>
    <div style={{ marginTop: 10, height: 6, width: 150, borderRadius: 999, background: `linear-gradient(90deg, ${C.accent2}, ${C.accent})` }} />
  </div>
);

/* ---- Mock de navegador com o PAINEL da plataforma ---- */
export const BrowserMock: React.FC<{ w?: number }> = ({ w = 760 }) => {
  const h = Math.round(w * 0.64);
  const kpi = [
    { l: "Faturamento", v: "R$ 12.4k" },
    { l: "Agendados", v: "38" },
    { l: "Assinantes", v: "21" },
  ];
  return (
    <div style={{ width: w, background: "#101010", borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 40px 90px rgba(0,0,0,0.5)", overflow: "hidden" }}>
      {/* barra do navegador */}
      <div style={{ height: 46, background: "#181818", display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["#E4614E", "#E4C77E", "#5BB98B"].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c, opacity: 0.9 }} />
          ))}
        </div>
        <div style={{ marginLeft: 12, flex: 1, height: 24, borderRadius: 999, background: "#0D0D0D", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 14px", fontFamily: UI, fontSize: 15, color: C.muted }}>
          barberagencia.com/admin
        </div>
      </div>
      {/* corpo: sidebar + main */}
      <div style={{ display: "flex", height: h - 46 }}>
        <div style={{ width: w * 0.2, background: "#141414", borderRight: `1px solid ${C.border}`, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <LogoMark size={38} />
          {["Agenda", "Fila", "Clientes", "Planos", "Relatórios"].map((m, i) => (
            <div key={m} style={{ height: 16, borderRadius: 6, background: i === 0 ? C.accent : "rgba(255,255,255,0.08)", width: i === 0 ? "85%" : `${60 + ((i * 7) % 30)}%` }} />
          ))}
        </div>
        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {kpi.map((k) => (
              <div key={k.l} style={{ flex: 1, background: "#161616", border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontFamily: UI, fontSize: 14, color: C.muted }}>{k.l}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 30, color: C.accent, marginTop: 4 }}>{k.v}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#161616", border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, flex: 1, display: "flex", alignItems: "flex-end", gap: 12 }}>
            {[0.4, 0.55, 0.5, 0.72, 0.65, 0.9, 1].map((b, i) => (
              <div key={i} style={{ flex: 1, height: `${b * 100}%`, borderRadius: "6px 6px 0 0", background: i === 6 ? `linear-gradient(180deg, ${C.accent2}, ${C.accent})` : "#2E2A22" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---- Mock do APP do cliente ---- */
export const PhoneApp: React.FC = () => (
  <div style={{ width: 300, height: 600, borderRadius: 46, background: "#0F0F0F", border: `1px solid ${C.border}`, boxShadow: "0 40px 90px rgba(0,0,0,0.55)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
    {/* header do app */}
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px" }}>
      <LogoMark size={34} />
      <div style={{ fontFamily: DISPLAY, fontSize: 20, color: C.text, textTransform: "uppercase", letterSpacing: 1 }}>Studio</div>
    </div>
    {/* hero */}
    <div style={{ borderRadius: 16, background: "linear-gradient(135deg, #1c1712, #141414)", border: `1px solid ${C.border}`, padding: 16 }}>
      <div style={{ fontFamily: UI, fontSize: 15, color: C.muted, letterSpacing: 2, textTransform: "uppercase" }}>Seu plano</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 26, color: C.text, marginTop: 4 }}>3 de 4 cortes</div>
      <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: "#2A2620" }}>
        <div style={{ width: "75%", height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${C.accent2}, ${C.accent})` }} />
      </div>
    </div>
    {/* serviços */}
    {["Corte + Barba", "Corte social", "Barba"].map((s, i) => (
      <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#161616", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ fontFamily: UI, fontSize: 16, color: C.text }}>{s}</div>
        <div style={{ fontFamily: UI, fontSize: 15, color: C.muted }}>{["45min", "30min", "20min"][i]}</div>
      </div>
    ))}
    {/* CTA */}
    <div style={{ marginTop: "auto", height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${C.accent2}, ${C.accent})`, color: "#171717", fontFamily: DISPLAY, fontSize: 18, textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center" }}>
      Agendar horário
    </div>
  </div>
);

/* ---- Gráfico de barras crescente ---- */
export const RisingBars: React.FC = () => {
  const hs = [0.34, 0.48, 0.6, 0.76, 1];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 24, height: 320 }}>
      {hs.map((h, i) => (
        <div key={i} style={{ width: 92, height: `${h * 100}%`, borderRadius: "12px 12px 0 0", background: i === hs.length - 1 ? `linear-gradient(180deg, ${C.accent2}, ${C.accent})` : "#332F28" }} />
      ))}
    </div>
  );
};
