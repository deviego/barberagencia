"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Check, Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** URL pública da barbearia (para onde o QR leva o cliente). */
  publicUrl: string;
  /** Slug da barbearia (nome do arquivo baixado). */
  slug: string;
  /** QR já renderizado no servidor (data URL, correção de erro alta). */
  qrDataUrl: string;
  /** Logo embutida como data URL (evita canvas "tainted" ao exportar). */
  logoDataUrl: string | null;
  /** Iniciais da marca, usadas quando não há logo. */
  logoText: string;
  name: string;
  instagram: string | null;
  accent: string;
};

const POSTER_W = 1080;
const POSTER_H = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function normalizeInstagram(raw: string | null): string | null {
  if (!raw) return null;
  const handle = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();
  return handle ? `@${handle}` : null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Desenha a logo (ou as iniciais) centralizada num quadrado branco arredondado. */
function drawLogoBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  side: number,
  logo: HTMLImageElement | null,
  logoText: string,
  accent: string,
) {
  const x = cx - side / 2;
  const y = cy - side / 2;
  // "buraco" branco no meio do QR
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y, side, side, side * 0.18);
  ctx.fill();
  ctx.restore();

  if (logo) {
    const pad = side * 0.16;
    const area = side - pad * 2;
    const ratio = Math.min(area / logo.width, area / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
  } else {
    // Sem logo: círculo com as iniciais.
    const r = side * 0.42;
    ctx.save();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(side * 0.34)}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText((logoText || "??").slice(0, 2).toUpperCase(), cx, cy + side * 0.02);
    ctx.restore();
  }
}

export function ClientQr(props: Props) {
  const { publicUrl, slug, qrDataUrl, logoDataUrl, logoText, name, instagram, accent } = props;
  const posterRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const insta = normalizeInstagram(instagram);
  const domain = publicUrl.replace(/^https?:\/\//, "");

  /** Desenha o QR + logo dentro de um quadrado (usado no cartaz e no "só QR"). */
  const drawQrSquare = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, qr: HTMLImageElement, logo: HTMLImageElement | null) => {
      ctx.drawImage(qr, x, y, size, size);
      drawLogoBadge(ctx, x + size / 2, y + size / 2, size * 0.24, logo, logoText, accent);
    },
    [logoText, accent],
  );

  /** Desenha o cartaz completo (parede/banner). */
  const drawPoster = useCallback(
    (ctx: CanvasRenderingContext2D, qr: HTMLImageElement, logo: HTMLImageElement | null) => {
      const W = POSTER_W;
      const H = POSTER_H;
      ctx.clearRect(0, 0, W, H);
      // fundo
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      // moldura
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      roundRect(ctx, 30, 30, W - 60, H - 60, 30);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      // nome (encolhe para caber)
      let fontSize = 68;
      ctx.fillStyle = "#14110E";
      do {
        ctx.font = `bold ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
        if (ctx.measureText(name).width <= 860) break;
        fontSize -= 3;
      } while (fontSize > 34);
      ctx.fillText(name, W / 2, 175);

      // tracinho de destaque
      ctx.fillStyle = accent;
      roundRect(ctx, W / 2 - 46, 205, 92, 6, 3);
      ctx.fill();

      // subtítulo
      ctx.fillStyle = "#6B6B6B";
      ctx.font = `500 34px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillText("Agende e cadastre-se pelo celular", W / 2, 275);

      // cartão do QR
      const card = 720;
      const cx = (W - card) / 2;
      const cy = 330;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.10)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = "#FFFFFF";
      roundRect(ctx, cx, cy, card, card, 32);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "#ECE7DD";
      ctx.lineWidth = 2;
      roundRect(ctx, cx, cy, card, card, 32);
      ctx.stroke();

      const qrPad = 46;
      drawQrSquare(ctx, cx + qrPad, cy + qrPad, card - qrPad * 2, qr, logo);

      // chamada
      ctx.fillStyle = "#14110E";
      ctx.font = `600 32px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillText("Aponte a câmera do celular e toque no link", W / 2, cy + card + 78);

      // link
      ctx.fillStyle = accent;
      ctx.font = `bold 32px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillText(domain, W / 2, cy + card + 132);

      // instagram
      if (insta) {
        ctx.fillStyle = "#6B6B6B";
        ctx.font = `500 30px 'Segoe UI', system-ui, sans-serif`;
        ctx.fillText(insta, W / 2, cy + card + 182);
      }
    },
    [accent, name, domain, insta, drawQrSquare],
  );

  // Renderiza o preview do cartaz quando as imagens carregam.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [qr, logo] = await Promise.all([
        loadImage(qrDataUrl),
        logoDataUrl ? loadImage(logoDataUrl).catch(() => null) : Promise.resolve(null),
      ]);
      if (!alive) return;
      const canvas = posterRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawPoster(ctx, qr, logo);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [qrDataUrl, logoDataUrl, drawPoster]);

  function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  }

  function baixarCartaz() {
    if (posterRef.current) downloadCanvas(posterRef.current, `cartaz-${slug}.png`);
  }

  async function baixarQr() {
    const [qr, logo] = await Promise.all([
      loadImage(qrDataUrl),
      logoDataUrl ? loadImage(logoDataUrl).catch(() => null) : Promise.resolve(null),
    ]);
    const size = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);
    const pad = 90;
    drawQrSquare(ctx, pad, pad, size - pad * 2, qr, logo);
    downloadCanvas(canvas, `qr-${slug}.png`);
  }

  function copy() {
    navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" id="qr-cliente">
      <div className="flex items-center gap-2">
        <div className="text-overline uppercase text-text-muted">QR Code da barbearia</div>
        <QrCode size={16} className="text-text-muted" />
      </div>
      <p className="text-caption text-text-2">
        QR único da sua barbearia — leva o cliente direto para a sua página, onde ele agenda e se cadastra.
        Baixe o cartaz pronto (com a sua logo), imprima e cole na parede ou use em um banner.
      </p>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* Preview do cartaz */}
        <div className="mx-auto w-full max-w-[280px] shrink-0">
          <canvas
            ref={posterRef}
            width={POSTER_W}
            height={POSTER_H}
            className="w-full rounded-md border border-border bg-white shadow-sm"
            style={{ aspectRatio: `${POSTER_W} / ${POSTER_H}` }}
          />
        </div>

        {/* Ações */}
        <div className="flex flex-1 flex-col gap-2">
          <Button onClick={baixarCartaz} disabled={!ready}>
            <Download size={16} /> Baixar cartaz (PNG)
          </Button>
          <Button variant="outline" onClick={baixarQr} disabled={!ready}>
            <QrCode size={16} /> Baixar só o QR (PNG)
          </Button>
          <Button variant="ghost" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Link copiado!" : "Copiar link"}
          </Button>
          <p className="mt-1 break-all text-caption text-text-muted">{domain}</p>
          <p className="text-caption text-text-muted">
            Dica: o cartaz tem 1080×1350 — ótimo para imprimir (A4/A5) ou postar nos stories.
          </p>
        </div>
      </div>
    </section>
  );
}
