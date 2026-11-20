import QRCode from "qrcode";

/**
 * Cartazes de QR (#127): A4 retrato, fundo escuro com dourado. Tudo é desenhado no canvas em
 * coordenadas de impressão (2480 × 3508 px = A4 a 300 dpi); a pré-visualização usa o mesmo
 * desenho em escala menor. 1 mm = 11,81 px.
 */
export const A4_W = 2480;
export const A4_H = 3508;
const MM = A4_W / 210;

export type PosterModel = "QUEUE" | "SIGNUP";
/** Como o cliente entra na fila: com login (hoje) ou pelo telefone (fila rápida, #123/#102). */
export type QueueEntryMode = "LOGIN" | "PHONE";

export type PosterInput = {
  model: PosterModel;
  url: string;
  name: string;
  initials: string;
  logo: HTMLImageElement | null;
  /** Selo da Barber Agência para o rodapé (public/barber-agencia-logo.jpeg). null = anel "BA" desenhado. */
  seal?: HTMLImageElement | null;
  queueEntry: QueueEntryMode;
  fonts: { display: string; text: string };
};

const GOLD = "#D4B062";
const GOLD_DIM = "rgba(212,176,98,0.55)";
const WHITE = "#F5F2EA";
const BG = "#0B0A08";
const BOX = "#141210";

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
      steps: [
        "Aponte a câmera do celular para o QR code",
        input.queueEntry === "PHONE" ? "Digite o seu telefone" : "Entre na sua conta ou faça o cadastro",
        "Pegue a senha e acompanhe a fila na tela",
      ],
    };
  }
  return {
    overline: "CADASTRO DO CLIENTE",
    title: ["FAÇA O SEU", "CADASTRO"],
    subtitle: [
      { text: "Cadastre-se na " },
      { text: input.name, strong: true },
      { text: " e agende o seu próximo corte pelo celular, quando quiser." },
    ],
    steps: [
      "Aponte a câmera do celular para o QR code",
      'Toque em "Cadastrar" e preencha os seus dados',
      "Escolha o serviço, o barbeiro e o horário",
    ],
  };
}

function font(weight: number, size: number, family: string) {
  return `${weight} ${Math.round(size)}px ${family}`;
}

/** Texto com espaçamento entre letras, centralizado em cx. */
function spacedText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
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
    return ctx.measureText(w.text).width;
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
    return sum + ctx.measureText(w.text).width;
  }, 0);
}

function wrapPlain(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function drawQr(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = Math.floor(size / n);
  const real = cell * n;
  const ox = Math.round(x + (size - real) / 2);
  const oy = Math.round(y + (size - real) / 2);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
    }
  }
}

/** Logo inteira (sem cortar nem distorcer) dentro do círculo dourado; sem logo, as iniciais. */
function drawLogoCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, input: PosterInput) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = BOX;
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.restore();

  if (input.logo && input.logo.width > 0) {
    const side = r * Math.SQRT2 * 0.98; // quadrado inscrito: a logo cabe inteira
    const k = Math.min(side / input.logo.width, side / input.logo.height);
    const w = input.logo.width * k;
    const h = input.logo.height * k;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 7, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(input.logo, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
    return;
  }
  const initials = (input.initials || "").trim().slice(0, 2).toUpperCase() || "BB";
  ctx.fillStyle = GOLD;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font(800, r * 0.95, input.fonts.display);
  ctx.fillText(initials, cx, cy + r * 0.04);
  ctx.textBaseline = "alphabetic";
}

/** Desenha o cartaz inteiro. `scale` = tamanho do canvas / A4_W. */
export function drawPoster(ctx: CanvasRenderingContext2D, input: PosterInput, scale = 1) {
  const { display, text } = input.fonts;
  const copy = copyFor(input);
  const W = A4_W;
  const cx = W / 2;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // Fundo escuro com brilho dourado no topo
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, A4_W, A4_H);
  const glow = ctx.createRadialGradient(cx, 0, 0, cx, 0, A4_H * 0.55);
  glow.addColorStop(0, "rgba(212,176,98,0.14)");
  glow.addColorStop(1, "rgba(212,176,98,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, A4_W, A4_H);

  // Borda dourada fina a 11 mm do papel (mínimo pedido: 10 mm)
  const inset = Math.round(11 * MM);
  ctx.strokeStyle = GOLD_DIM;
  ctx.lineWidth = 5;
  ctx.strokeRect(inset, inset, A4_W - inset * 2, A4_H - inset * 2);
  const innerW = A4_W - inset * 2 - 2 * 110;

  // Logo
  drawLogoCircle(ctx, cx, 450, 240, input);

  // Sobretítulo
  ctx.textAlign = "center";
  ctx.fillStyle = GOLD;
  ctx.font = font(700, 44, text);
  spacedText(ctx, copy.overline, cx, 800, 22);

  // Título (2 linhas), diminui se precisar
  let titleSize = 230;
  ctx.font = font(800, titleSize, display);
  while (titleSize > 120 && Math.max(...copy.title.map((t) => ctx.measureText(t).width)) > innerW) {
    titleSize -= 6;
    ctx.font = font(800, titleSize, display);
  }
  ctx.fillText(copy.title[0], cx, 1060);
  ctx.fillText(copy.title[1], cx, 1060 + titleSize * 0.95);

  // Subtítulo com destaque dourado: diminui e quebra linha até caber em 3 linhas
  const subTop = 1060 + titleSize * 0.95 + 150;
  let subSize = 56;
  let lines: Word[][] = [];
  let normal = "";
  let strong = "";
  for (; subSize >= 38; subSize -= 2) {
    normal = font(400, subSize, text);
    strong = font(700, subSize, text);
    lines = wrapSegments(ctx, copy.subtitle, Math.min(innerW - 120, 1700), normal, strong);
    if (lines.length <= 3) break;
  }
  const subLead = subSize * 1.4;
  lines.forEach((line, i) => {
    const total = lineWidth(ctx, line, normal, strong);
    let x = cx - total / 2;
    ctx.textAlign = "left";
    for (const w of line) {
      ctx.font = w.strong ? strong : normal;
      ctx.fillStyle = w.strong ? GOLD : WHITE;
      ctx.fillText(w.text, x, subTop + i * subLead);
      x += ctx.measureText(w.text).width;
    }
  });
  ctx.textAlign = "center";

  // De baixo para cima: rodapé fixo, passos logo acima dele, QR no espaço que sobra.
  const footY = A4_H - inset - 190;
  const sealR = 82;
  const stepH = 330;
  const stepY = footY - sealR - 80 - stepH;

  // QR: caixa branca com moldura dourada e 50 px de margem branca. Caixa entre 927 e 1000 px:
  // os módulos ficam entre 827 px (7 cm, o mínimo) e 900 px (7,6 cm).
  const subBottom = subTop + (lines.length - 1) * subLead;
  const space = stepY - 80 - (subBottom + 90);
  const box = Math.max(927, Math.min(1000, space));
  const boxX = cx - box / 2;
  const boxY = subBottom + 90 + Math.max(0, (space - box) / 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(boxX, boxY, box, box);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 14;
  ctx.strokeRect(boxX - 7, boxY - 7, box + 14, box + 14);
  drawQr(ctx, input.url, boxX + 50, boxY + 50, box - 100);

  // 3 passos
  const gap = 60;
  const stepsX = inset + 80;
  const stepW = (A4_W - stepsX * 2 - gap * 2) / 3;
  copy.steps.forEach((s, i) => {
    const x = stepsX + i * (stepW + gap);
    ctx.fillStyle = BOX;
    ctx.fillRect(x, stepY, stepW, stepH);
    ctx.strokeStyle = GOLD_DIM;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, stepY, stepW, stepH);
    ctx.fillStyle = GOLD;
    ctx.font = font(800, 104, display);
    ctx.fillText(String(i + 1), x + stepW / 2, stepY + 125);
    let size = 44;
    ctx.font = font(400, size, text);
    let stepLines = wrapPlain(ctx, s, stepW - 70);
    while (stepLines.length > 3 && size > 34) {
      size -= 2;
      ctx.font = font(400, size, text);
      stepLines = wrapPlain(ctx, s, stepW - 70);
    }
    ctx.fillStyle = WHITE;
    stepLines.forEach((l, j) => ctx.fillText(l, x + stepW / 2, stepY + 205 + j * size * 1.3));
  });

  // Rodapé: selo + Tecnologia Barber Agência · barberagencia.com
  ctx.font = font(400, 40, text);
  const l1a = "Tecnologia ";
  const l1b = "Barber Agência";
  const w1a = ctx.measureText(l1a).width;
  ctx.font = font(700, 40, text);
  const w1b = ctx.measureText(l1b).width;
  ctx.font = font(400, 38, text);
  const w2 = ctx.measureText("barberagencia.com").width;
  const textW = Math.max(w1a + w1b, w2);
  const groupW = sealR * 2 + 40 + textW;
  const sealCx = cx - groupW / 2 + sealR;
  ctx.beginPath();
  ctx.arc(sealCx, footY, sealR, 0, Math.PI * 2);
  ctx.fillStyle = BG;
  ctx.fill();
  if (input.seal && input.seal.width > 0) {
    // O arquivo é uma página retrato com o nome dourado no meio: recorta um quadrado em volta do nome.
    const crop = Math.min(input.seal.width, input.seal.height) * 0.8;
    const sx = (input.seal.width - crop) / 2;
    const sy = input.seal.height * 0.49 - crop / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sealCx, footY, sealR - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(input.seal, sx, sy, crop, crop, sealCx - sealR, footY - sealR, sealR * 2, sealR * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = GOLD;
    ctx.font = font(800, 78, display);
    ctx.textBaseline = "middle";
    ctx.fillText("BA", sealCx, footY + 4);
    ctx.textBaseline = "alphabetic";
  }
  ctx.beginPath();
  ctx.arc(sealCx, footY, sealR, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  const tx = sealCx + sealR + 40;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(245,242,234,0.75)";
  ctx.font = font(400, 40, text);
  ctx.fillText(l1a, tx, footY - 8);
  ctx.fillStyle = WHITE;
  ctx.font = font(700, 40, text);
  ctx.fillText(l1b, tx + w1a, footY - 8);
  ctx.fillStyle = "rgba(245,242,234,0.75)";
  ctx.font = font(400, 38, text);
  ctx.fillText("barberagencia.com", tx, footY + 50);
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
    ctx.fillStyle = BG;
    ctx.fillRect(x, x, side, side);
    ctx.fillStyle = GOLD;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font(800, side * 0.55, fonts.display);
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
