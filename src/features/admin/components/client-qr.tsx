"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, Download, FileText, QrCode, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  A4_H,
  A4_W,
  assertPosterUrl,
  drawPoster,
  drawQrOnly,
  jpegToA4Pdf,
  pngWithDpi,
  type PosterInput,
  type PosterModel,
  type QueueEntryMode,
} from "./qr-posters/draw";
import { QUICK_QUEUE_ADMIN_MESSAGES } from "@/features/quick-queue/types";

type Props = {
  /** Link público do cliente: /b/<slug> (modelo B, Cadastro). */
  publicUrl: string;
  /** Link da fila do cliente: /b/<slug>/fila (modelo A). null = plano sem fila ou fila desligada. */
  queueUrl: string | null;
  /** Fila no plano e ligada com a fila rápida desligada: avisa onde está o cartaz da fila (#102). */
  queuePosterHint?: boolean;
  /** Como o cliente entra na fila hoje (muda o passo 2 do modelo A). */
  queueEntry: QueueEntryMode;
  slug: string;
  /** Logo embutida como data URL (evita canvas "tainted" ao exportar). */
  logoDataUrl: string | null;
  /** Iniciais da marca, usadas quando não há logo (ou ela não carrega). */
  logoText: string;
  name: string;
  /** Cor da marca da barbearia; sem ela, o cartaz usa o dourado padrão. */
  accent: string | null;
};

const ERROR = "Não deu certo. Tente de novo.";
const PREVIEW_SCALE = 0.25; // 620 × 877 no canvas da pré-visualização
const SEAL_SRC = "/barber-agencia-selo.png";
const MODE_KEY = (slug: string) => `bb-cartaz-fila-modo:${slug}`;

const MODELS: { key: PosterModel; label: string }[] = [
  { key: "QUEUE", label: "Fila digital" },
  { key: "SIGNUP", label: "Cadastro do cliente" },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Fontes do app (Big Shoulders e Inter), carregadas antes de desenhar no canvas. */
async function loadFonts(): Promise<PosterInput["fonts"]> {
  const css = getComputedStyle(document.body);
  const display = `${css.getPropertyValue("--font-big-shoulders").trim() || "'Big Shoulders'"}, Inter, sans-serif`;
  const text = `${css.getPropertyValue("--font-inter").trim() || "Inter"}, system-ui, sans-serif`;
  try {
    await Promise.all([
      document.fonts.load(`700 100px ${display}`),
      document.fonts.load(`400 40px ${text}`),
      document.fonts.load(`600 40px ${text}`),
      document.fonts.load(`700 40px ${text}`),
    ]);
  } catch {
    // sem a fonte, o cartaz sai com a fonte reserva: não trava o download
  }
  return { display, text };
}

function readStoredMode(slug: string): string | null {
  try {
    return localStorage.getItem(MODE_KEY(slug));
  } catch {
    return null;
  }
}

function storeMode(slug: string, mode: QueueEntryMode) {
  try {
    localStorage.setItem(MODE_KEY(slug), mode);
  } catch {
    // sem armazenamento local: só não avisa da próxima vez
  }
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), type, quality),
  );
}

export function ClientQr({ publicUrl, queueUrl, queuePosterHint = false, queueEntry, slug, logoDataUrl, logoText, name, accent }: Props) {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const [model, setModel] = useState<PosterModel>(queueUrl ? "QUEUE" : "SIGNUP");
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [seal, setSeal] = useState<HTMLImageElement | null>(null);
  const [fonts, setFonts] = useState<PosterInput["fonts"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [modeChanged, setModeChanged] = useState(false);

  const canQueue = !!queueUrl;
  const activeModel: PosterModel = canQueue ? model : "SIGNUP";
  const url = activeModel === "QUEUE" && queueUrl ? queueUrl : publicUrl;
  const kind = activeModel === "QUEUE" ? "fila" : "cadastro";
  const ready = !!fonts;

  // Logo (se não carregar, fica null e o cartaz usa as iniciais) + fontes.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [img, sealImg, f] = await Promise.all([
        logoDataUrl ? loadImage(logoDataUrl).catch(() => null) : Promise.resolve(null),
        loadImage(SEAL_SRC).catch(() => null), // não carregou: o rodapé usa o anel "BA"
        loadFonts(),
      ]);
      if (!alive) return;
      setLogo(img);
      setSeal(sealImg);
      setFonts(f);
    })();
    return () => {
      alive = false;
    };
  }, [logoDataUrl]);

  // Aviso quando o modo da fila mudou desde o último cartaz de fila baixado neste aparelho.
  useEffect(() => {
    if (!canQueue) return;
    const stored = readStoredMode(slug);
    setModeChanged(!!stored && stored !== queueEntry);
  }, [canQueue, slug, queueEntry]);

  function input(): PosterInput {
    return { model: activeModel, url: assertPosterUrl(url), name, initials: logoText, logo, seal, accent, queueEntry, fonts: fonts! };
  }

  useEffect(() => {
    if (!fonts) return;
    const canvas = previewRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    try {
      drawPoster(ctx, { model: activeModel, url: assertPosterUrl(url), name, initials: logoText, logo, seal, accent, queueEntry, fonts }, PREVIEW_SCALE);
    } catch {
      setError(ERROR);
    }
  }, [fonts, logo, seal, accent, activeModel, url, name, logoText, queueEntry]);

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch {
      setError(ERROR);
    } finally {
      setBusy(false);
    }
  }

  function fullCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = A4_W;
    canvas.height = A4_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    drawPoster(ctx, input(), 1);
    return canvas;
  }

  function afterPosterDownload() {
    if (activeModel !== "QUEUE") return;
    storeMode(slug, queueEntry);
    setModeChanged(false);
  }

  const baixarPng = () =>
    run(async () => {
      const png = new Uint8Array(await (await canvasBlob(fullCanvas(), "image/png")).arrayBuffer());
      save(new Blob([pngWithDpi(png, 300) as BlobPart], { type: "image/png" }), `cartaz-${kind}-${slug}.png`);
      afterPosterDownload();
    });

  const baixarPdf = () =>
    run(async () => {
      const jpeg = new Uint8Array(await (await canvasBlob(fullCanvas(), "image/jpeg", 0.92)).arrayBuffer());
      save(jpegToA4Pdf(jpeg, A4_W, A4_H), `cartaz-${kind}-${slug}.pdf`);
      afterPosterDownload();
    });

  const baixarQr = () =>
    run(async () => {
      const size = 1080;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      drawQrOnly(ctx, assertPosterUrl(url), size, logo, logoText, fonts!);
      save(await canvasBlob(canvas, "image/png"), `qr-${kind}-${slug}.png`);
    });

  function copy() {
    let safe: string;
    try {
      safe = assertPosterUrl(url); // a mesma guarda do totem dos cartazes
    } catch {
      setError(ERROR);
      return;
    }
    navigator.clipboard?.writeText(safe).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => setError(ERROR),
    );
  }

  const locked = !ready || busy;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" id="qr-cliente">
      <div className="flex items-center gap-2">
        <QrCode size={16} className="text-text-muted" aria-hidden />
        <h2 className="text-overline uppercase text-text-muted">QR para o cliente</h2>
      </div>
      <p className="text-caption text-text-2">
        {canQueue
          ? // Copy do #102: só com a fila do cliente disponível (o cartaz A leva para a fila).
            "Imprima e deixe no balcão ou na parede. O cliente escaneia e pega a senha no celular."
          : "Cartaz pronto para imprimir em A4, com a sua logo. Cole na parede e o cliente aponta a câmera, sem pedir ajuda no balcão."}
      </p>

      {canQueue && (
        <div role="radiogroup" aria-label="Modelo do cartaz" className="grid w-full grid-cols-2 rounded-md border border-border bg-surface-2 p-0.5 sm:w-fit">
          {MODELS.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={activeModel === m.key}
              onClick={() => setModel(m.key)}
              className={`min-h-11 rounded px-3 text-caption font-semibold transition ${
                activeModel === m.key ? "bg-accent text-accent-contrast shadow-sm" : "text-text-muted hover:text-text"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {!canQueue && queuePosterHint && (
        <p role="status" className="text-caption text-text-2">
          {QUICK_QUEUE_ADMIN_MESSAGES.posterHint}
        </p>
      )}

      {canQueue && modeChanged && activeModel === "QUEUE" && (
        <p role="status" className="flex items-start gap-2 text-caption text-warning-strong">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          Você mudou o modo da fila. Imprima o cartaz de novo para o passo 2 ficar certo.
        </p>
      )}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="mx-auto w-full max-w-[260px] shrink-0">
          <canvas
            ref={previewRef}
            width={Math.round(A4_W * PREVIEW_SCALE)}
            height={Math.round(A4_H * PREVIEW_SCALE)}
            role="img"
            aria-label={`Pré-visualização do cartaz ${activeModel === "QUEUE" ? "Fila digital" : "Cadastro do cliente"}`}
            className="h-auto w-full rounded-md border border-border bg-black shadow-sm"
            style={{ aspectRatio: `${A4_W} / ${A4_H}` }}
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Button onClick={baixarPng} disabled={locked} loading={busy}>
            <Download size={16} aria-hidden /> Baixar PNG
          </Button>
          <Button variant="outline" onClick={baixarPdf} disabled={locked}>
            <FileText size={16} aria-hidden /> Baixar PDF
          </Button>
          <Button variant="outline" onClick={baixarQr} disabled={locked}>
            <QrCode size={16} aria-hidden /> Baixar QR
          </Button>
          <Button variant="ghost" onClick={copy}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied ? "Link copiado!" : "Copiar link"}
          </Button>
          <p className="mt-1 break-all text-caption text-text-muted">{url.replace(/^https?:\/\//, "")}</p>
          {error && (
            <p role="alert" className="text-caption text-danger">
              {error}
            </p>
          )}
          <p className="text-caption text-text-muted">A4 (21 × 29,7 cm), pronto para qualquer impressora.</p>
        </div>
      </div>
    </section>
  );
}
