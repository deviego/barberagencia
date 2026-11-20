import QRCode from "qrcode";

/**
 * Cartazes de QR (#127), iguais ao modelo aprovado: A4 retrato, fundo preto com brilho no topo,
 * logo num círculo branco, título em Big Shoulders, QR numa caixa branca e 3 passos.
 * Tudo é desenhado em coordenadas de impressão (2480 × 3508 px = A4 a 300 dpi). As medidas
 * abaixo estão em "px do modelo" (página de 794 × 1123) e viram px de impressão por `U`.
 * Onde o modelo usa a cor da marca, entra a cor da barbearia (`accent`).
 */
export const A4_W = 2480;
export const A4_H = 3508;
const MM = A4_W / 210;
/** 1 px do modelo (794 px de largura) em px de impressão. */
const U = A4_W / 794;

export type PosterModel = "QUEUE" | "SIGNUP";
/** Como o cliente entra na fila. Hoje só com login; a fila rápida ainda não está no ar. */
export type QueueEntryMode = "LOGIN" | "PHONE";

export type PosterInput = {
  model: PosterModel;
  url: string;
  name: string;
  initials: string;
  logo: HTMLImageElement | null;
  /** Selo redondo da Barber Agência para o rodapé (public/barber-agencia-selo.png). null = "BA" desenhado. */
  seal?: HTMLImageElement | null;
  /** Cor da marca da barbearia (#RRGGBB). Sem cor válida, o dourado padrão. */
  accent?: string | null;
  queueEntry: QueueEntryMode;
  fonts: { display: string; text: string };
};

/** Dourado padrão da plataforma: o mesmo do modelo. */
export const DEFAULT_ACCENT = "#C9A24B";
/** Dourado da Barber Agência no rodapé ("Tecnologia Barber Agência"): não muda com a barbearia. */
const BA_GOLD = DEFAULT_ACCENT;
const TEXT = "#F5F1E8";
const TEXT_2 = "#B9B3A4";
const BOX = "#121212";
const BG = "#000000";

type RGB = [number, number, number];

function parseHex(hex: string | null | undefined): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (c: RGB, a = 1) => (a === 1 ? `rgb(${c.map(clamp).join(",")})` : `rgba(${c.map(clamp).join(",")},${a})`);
const shift = (c: RGB, d: RGB): RGB => [c[0] + d[0], c[1] + d[1], c[2] + d[2]];

/**
 * Paleta do cartaz a partir da cor da marca. Com o dourado padrão sai exatamente a do modelo:
 * título #DDB85F, destaques e números #E8C873, brilho do topo #2A2210 → #0A0906 → preto.
 */
function palette(accent: string | null | undefined) {
  const c = parseHex(accent) ?? (parseHex(DEFAULT_ACCENT) as RGB);
  return {
    accent: rgb(c),
    line: rgb(c, 0.6),
    title: rgb(shift(c, [20, 22, 20])),
    light: rgb(shift(c, [31, 38, 40])),
    glow0: rgb([c[0] * 0.21, c[1] * 0.21, c[2] * 0.21]),
    glow1: rgb([c[0] * 0.05, c[1] * 0.05, c[2] * 0.05]),
  };
}

/** Nenhum cartaz leva o acesso do totem (link, chave ou token). */
export function assertPosterUrl(url: string): string {
  const u = new URL(url);
  if (/\/totem(\/|$)/i.test(u.pathname) || u.search || u.hash) {
    throw new Error("[qr-posters] link não permitido no cartaz");
  }
  return url;
}

type Seg = { text: string; strong?: boolean };

function copyFor(input: PosterInput): { overline: string; title: [string, string]; subtitle: Seg[]; steps: [string, string, string] } {
  if (input.model === "QUEUE") {
    return {
      overline: "FILA DIGITAL",
      title: ["ENTRE NA FILA", "PELO CELULAR"],
      subtitle: [
        { text: "Aponte a câmera, pegue a sua senha e " },
        { text: "acompanhe a sua vez", strong: true },
        { text: " sem ficar em pé esperando." },
      ],
      // Passo 2 com conta: a fila sem conta (fila rápida) ainda não está no ar.
      steps: ["Aponte a câmera do celular para o QR code", "Entre na sua conta ou faça o cadastro", "Pegue a senha e acompanhe a fila na tela"],
    };
  }
  return {
    overline: "CADASTRO DO CLIENTE",
    title: ["FAÇA O SEU", "CADASTRO"],
    subtitle: [
      { text: "Cadastre-se na " },
      { text: input.name.trim(), strong: true },
      { text: " e agende o seu próximo corte pelo celular, quando quiser." },
    ],
    steps: ["Aponte a câmera do celular para o QR code", 'Toque em "Cadastrar" e preencha os seus dados', "Escolha o serviço, o barbeiro e o horário"],
  };
}

/**
 * Texto na escala do modelo: a fonte é pedida no tamanho do modelo (ex.: 18,66 px) e o desenho
 * é ampliado para a impressão. O Inter muda de desenho conforme o tamanho pedido (eixo óptico);
 * pedir 58 px direto daria o corte de título, mais estreito, e as linhas quebrariam em outro lugar.
 */
function fill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(U, U);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Largura do texto em px de impressão (a fonte está no tamanho do modelo). */
function measure(ctx: CanvasRenderingContext2D, text: string) {
  return ctx.measureText(text).width * U;
}

function font(weight: number, size: number, family: string) {
  return `${weight} ${Math.round(size * 100) / 100}px ${family}`;
}

/** Texto com espaçamento entre letras (como o letter-spacing do CSS), centralizado em cx. */
function spacedText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  const chars = [...text];
  const widths = chars.map((c) => measure(ctx, c));
  const total = widths.reduce((a, b) => a + b, 0) + spacing * chars.length;
  let x = cx - total / 2;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    fill(ctx, c, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = "center";
}

type Word = { text: string; strong: boolean };

/** Quebra os trechos (normal/destaque) em linhas que cabem em maxW. */
function wrapSegments(ctx: CanvasRenderingContext2D, segs: Seg[], maxW: number, normal: string, strong: string): Word[][] {
  const words: Word[] = [];
  for (const s of segs) {
    for (const part of s.text.split(/(\s+)/)) {
      if (part) words.push({ text: part, strong: !!s.strong });
    }
  }
  const width = (w: Word) => {
    ctx.font = w.strong ? strong : normal;
    return measure(ctx, w.text);
  };
  const lines: Word[][] = [];
  let line: Word[] = [];
  let lineW = 0;
  for (const w of words) {
    const isSpace = /^\s+$/.test(w.text);
    const ww = width(w);
    if (!isSpace && line.length && lineW + ww > maxW) {
      while (line.length && /^\s+$/.test(line[line.length - 1].text)) line.pop();
      lines.push(line);
      line = [];
      lineW = 0;
    }
    if (isSpace && !line.length) continue;
    line.push(w);
    lineW += ww;
  }
  while (line.length && /^\s+$/.test(line[line.length - 1].text)) line.pop();
  if (line.length) lines.push(line);
  return lines;
}

function lineWidth(ctx: CanvasRenderingContext2D, line: Word[], normal: string, strong: string) {
  return line.reduce((sum, w) => {
    ctx.font = w.strong ? strong : normal;
    return sum + measure(ctx, w.text);
  }, 0);
}

function wrapPlain(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(ctx, next) > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** 7 cm a 300 dpi, arredondado para cima: o lado mínimo dos módulos do QR no cartaz. */
export const QR_MIN_PX = Math.ceil(70 * MM);
const QR_MAX_PX = 900; // 7,6 cm

/**
 * Tamanho do QR em pixels inteiros por módulo: o lado real (célula × módulos) fica entre 7 cm e
 * 7,6 cm, o maior que couber em `avail`. Se nem 7 cm couber, 7 cm vence (o cartaz se ajusta).
 */
export function qrLayout(url: string, avail: number) {
  // Correção H, como no modelo (QR mais denso e que aguenta sujeira/dobra no papel).
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const minCell = Math.ceil(QR_MIN_PX / n);
  const maxCell = Math.max(minCell, Math.floor(QR_MAX_PX / n));
  const cell = Math.min(maxCell, Math.max(minCell, Math.floor(avail / n)));
  return { qr, n, cell, side: cell * n };
}

function drawQr(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof qrLayout>, x: number, y: number) {
  const { qr, n, cell } = layout;
  const ox = Math.round(x);
  const oy = Math.round(y);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
    }
  }
}

/** Logo no círculo branco com borda da cor da marca, preenchendo o círculo (como no modelo). */
function drawLogoCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, input: PosterInput, accent: string) {
  const outer = 80 * U;
  const border = 3 * U;
  const inner = outer - border;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  if (input.logo && input.logo.width > 0) {
    const k = Math.max((inner * 2) / input.logo.width, (inner * 2) / input.logo.height);
    const w = input.logo.width * k;
    const h = input.logo.height * k;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(input.logo, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  } else {
    const initials = (input.initials || "").trim().slice(0, 2).toUpperCase() || "BB";
    ctx.fillStyle = BOX;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font(700, (inner * 1.05) / U, input.fonts.display);
    fill(ctx, initials, cx, cy + inner * 0.04);
    ctx.textBaseline = "alphabetic";
  }

  ctx.beginPath();
  ctx.arc(cx, cy, outer - border / 2, 0, Math.PI * 2);
  ctx.lineWidth = border;
  ctx.strokeStyle = accent;
  ctx.stroke();
}

/** Desenha o cartaz inteiro. `scale` = tamanho do canvas / A4_W. */
export function drawPoster(ctx: CanvasRenderingContext2D, input: PosterInput, scale = 1) {
  const { display, text } = input.fonts;
  const copy = copyFor(input);
  const pal = palette(input.accent);
  const cx = A4_W / 2;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Fundo: preto com brilho da cor da marca no topo (elipse a partir do centro de cima).
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, A4_W, A4_H);
  ctx.save();
  ctx.scale(1, A4_H / A4_W);
  const r = Math.hypot(A4_W / 2, A4_W); // canto mais distante, na escala da elipse
  const glow = ctx.createRadialGradient(cx, 0, 0, cx, 0, r);
  glow.addColorStop(0, pal.glow0);
  glow.addColorStop(0.4, pal.glow1);
  glow.addColorStop(0.72, BG);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, A4_W, A4_W);
  ctx.restore();

  // Moldura fina a 30 px do papel (como no modelo).
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = U;
  ctx.strokeRect(30.5 * U, 30.5 * U, 733 * U, 1062 * U);

  // Logo
  drawLogoCircle(ctx, cx, 143.5 * U, input, pal.accent);

  // Sobretítulo (letter-spacing .42em)
  ctx.fillStyle = pal.accent;
  ctx.font = font(600, 13.33, text);
  spacedText(ctx, copy.overline, cx, 259 * U, 13.33 * 0.42 * U);

  // Título em 2 linhas; só diminui se não couber (o texto é fixo, então não acontece).
  let titleSize = 74.66;
  ctx.font = font(700, titleSize, display);
  const titleMax = 680 * U;
  while (Math.max(...copy.title.map((t) => measure(ctx, t))) > titleMax) {
    titleSize -= 1;
    ctx.font = font(700, titleSize, display);
  }
  ctx.fillStyle = pal.title;
  fill(ctx, copy.title[0], cx, 335 * U);
  fill(ctx, copy.title[1], cx, 402 * U);

  // Subtítulo: até 2 linhas com destaque; nome muito longo diminui a letra e, no limite, vai a 3 linhas.
  let subSize = 18.66;
  let lines: Word[][] = [];
  let normal = "";
  let strong = "";
  for (; subSize >= 15; subSize -= 0.5) {
    normal = font(400, subSize, text);
    strong = font(700, subSize, text);
    lines = wrapSegments(ctx, copy.subtitle, 545 * U, normal, strong);
    if (lines.length <= 2) break;
  }
  if (lines.length > 3) lines = lines.slice(0, 3);
  const subLead = 26 * U * (subSize / 18.66);
  lines.forEach((line, i) => {
    let x = cx - lineWidth(ctx, line, normal, strong) / 2;
    ctx.textAlign = "left";
    for (const w of line) {
      ctx.font = w.strong ? strong : normal;
      ctx.fillStyle = w.strong ? pal.light : TEXT;
      fill(ctx, w.text, x, 442 * U + i * subLead);
      x += measure(ctx, w.text);
    }
  });
  ctx.textAlign = "center";
  const subLast = 442 * U + (lines.length - 1) * subLead;

  // QR: caixa branca de 318 px com borda de 4 px da cor da marca. Os módulos nunca ficam
  // abaixo de 7 cm; a caixa só cresce se os módulos + margem branca não couberem nela.
  const border = 4 * U;
  const qrL = qrLayout(input.url, 0);
  const pad = Math.max(qrL.cell * 2, (318 * U - border * 2 - qrL.side) / 2);
  const box = qrL.side + (pad + border) * 2;
  const boxY = Math.max(501 * U, subLast + 33 * U);
  const boxX = cx - box / 2;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(boxX, boxY, box, box);
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = border;
  ctx.strokeRect(boxX + border / 2, boxY + border / 2, box - border, box - border);
  drawQr(ctx, qrL, cx - qrL.side / 2, boxY + border + pad);

  // 3 passos
  const stepY = Math.max(846 * U, boxY + box + 27 * U);
  const stepH = 105 * U;
  const gap = 19 * U;
  const stepW = ((673 - 38) / 3) * U; // 3 colunas e 2 vãos de 19 em 673 px, como no modelo
  const stepsX = cx - (stepW * 3 + gap * 2) / 2;
  copy.steps.forEach((s, i) => {
    const x = stepsX + i * (stepW + gap);
    ctx.fillStyle = BOX;
    ctx.fillRect(x, stepY, stepW, stepH);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = U;
    ctx.strokeRect(x + U / 2, stepY + U / 2, stepW - U, stepH - U);
    ctx.fillStyle = pal.light;
    ctx.font = font(700, 29.33, display);
    fill(ctx, String(i + 1), x + stepW / 2, stepY + 42 * U);
    let size = 14;
    ctx.font = font(400, size, text);
    const textMax = stepW - 28 * U; // borda + ~13 px de respiro de cada lado, como no modelo
    let stepLines = wrapPlain(ctx, s, textMax);
    while (stepLines.length > 2 && size > 12) {
      size -= 0.5;
      ctx.font = font(400, size, text);
      stepLines = wrapPlain(ctx, s, textMax);
    }
    ctx.fillStyle = TEXT;
    stepLines.forEach((l, j) => fill(ctx, l, x + stepW / 2, stepY + 65 * U + j * 19 * U));
  });

  // Rodapé: selo + "Tecnologia Barber Agência" / barberagencia.com (cores da Barber Agência).
  const sealR = 25 * U;
  const footY = 1046.5 * U; // centro do selo
  const fs = 12.66; // px do modelo (o texto é desenhado na escala do modelo)
  ctx.font = font(400, fs, text);
  const l1a = "Tecnologia ";
  const l1b = "Barber Agência";
  const w1a = measure(ctx, l1a);
  ctx.font = font(700, fs, text);
  const w1b = measure(ctx, l1b);
  ctx.font = font(400, fs, text);
  const w2 = measure(ctx, "barberagencia.com");
  const textW = Math.max(w1a + w1b, w2);
  const sealGap = 16.5 * U;
  const groupW = sealR * 2 + sealGap + textW;
  const sealCx = cx - groupW / 2 + sealR;
  ctx.beginPath();
  ctx.arc(sealCx, footY, sealR, 0, Math.PI * 2);
  ctx.fillStyle = BG;
  ctx.fill();
  if (input.seal && input.seal.width > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(sealCx, footY, sealR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(input.seal, sealCx - sealR, footY - sealR, sealR * 2, sealR * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = BA_GOLD;
    ctx.font = font(700, (sealR * 0.95) / U, display);
    ctx.textBaseline = "middle";
    fill(ctx, "BA", sealCx, footY + sealR * 0.05);
    ctx.textBaseline = "alphabetic";
  }
  ctx.beginPath();
  ctx.arc(sealCx, footY, sealR - U / 2, 0, Math.PI * 2);
  ctx.lineWidth = U;
  ctx.strokeStyle = BA_GOLD;
  ctx.stroke();
  const tx = sealCx + sealR + sealGap;
  ctx.textAlign = "left";
  ctx.fillStyle = TEXT_2;
  ctx.font = font(400, fs, text);
  fill(ctx, l1a, tx, 1042 * U);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = font(700, fs, text);
  fill(ctx, l1b, tx + w1a, 1042 * U);
  ctx.fillStyle = TEXT_2;
  ctx.font = font(400, fs, text);
  fill(ctx, "barberagencia.com", tx, 1060 * U);
  ctx.textAlign = "center";

  ctx.restore();
}

/** QR sozinho com a logo no meio (o "Baixar só o QR" de antes, agora do modelo escolhido). */
export function drawQrOnly(ctx: CanvasRenderingContext2D, url: string, size: number, logo: HTMLImageElement | null, initials: string, fonts: PosterInput["fonts"]) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const pad = Math.round(size * 0.08);
  const cell = Math.floor((size - pad * 2) / n);
  const o = Math.round((size - cell * n) / 2);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) ctx.fillRect(o + c * cell, o + r * cell, cell, cell);
  // selo central (até ~20% do lado, dentro da correção de erro H)
  const side = size * 0.2;
  const x = size / 2 - side / 2;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x - 8, x - 8, side + 16, side + 16);
  if (logo && logo.width > 0) {
    const k = Math.min(side / logo.width, side / logo.height);
    ctx.drawImage(logo, size / 2 - (logo.width * k) / 2, size / 2 - (logo.height * k) / 2, logo.width * k, logo.height * k);
  } else {
    ctx.fillStyle = BOX;
    ctx.fillRect(x, x, side, side);
    ctx.fillStyle = BA_GOLD;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font(700, side * 0.55, fonts.display);
    ctx.fillText((initials || "BB").slice(0, 2).toUpperCase(), size / 2, size / 2 + side * 0.03);
  }
}

/** PDF de 1 página A4 (210 × 297 mm) com o cartaz em JPEG. Sem biblioteca: o PDF mínimo é escrito à mão. */
export function jpegToA4Pdf(jpeg: Uint8Array, widthPx: number, heightPx: number): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (p: Uint8Array | string) => {
    const b = typeof p === "string" ? enc.encode(p) : p;
    parts.push(b);
    length += b.length;
  };
  const obj = (n: number, body: string) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };
  const W = 595.28;
  const H = 841.89;
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  obj(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  offsets[5] = length;
  push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push("\nendstream\nendobj\n");
  const xref = length;
  let table = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) table += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  push(`${table}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Grava a resolução (pHYs) no PNG do canvas, que sai sem ela: a impressão lê 300 dpi = A4 exato. */
export function pngWithDpi(png: Uint8Array, dpi: number): Uint8Array {
  const IHDR_END = 8 + 25; // assinatura + chunk IHDR (4 tamanho + 4 tipo + 13 dados + 4 CRC)
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1; // unidade: metro
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, IHDR_END), 0);
  out.set(chunk, IHDR_END);
  out.set(png.subarray(IHDR_END), IHDR_END + chunk.length);
  return out;
}
