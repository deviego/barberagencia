"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, MonitorSmartphone, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Acesso ao totem e ao painel a partir do admin: QR para escanear + copiar link
 *  (o totem pode ficar em QUALQUER dispositivo: tablet, celular, TV, etc.). */
export function TotemAccess({
  totemUrl,
  painelUrl,
  qrDataUrl,
  totemOn,
}: {
  totemUrl: string | null;
  painelUrl: string;
  qrDataUrl: string | null;
  totemOn: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  }

  return (
    <aside className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5">
      {/* Totem */}
      {totemOn && totemUrl && (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-1.5 text-overline uppercase text-text-muted">
            <MonitorSmartphone size={14} /> Totem
          </div>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR do totem" className="h-44 w-44 rounded-md border border-border" />
          )}
          <p className="text-caption text-text-2">
            Coloque o totem em <strong>qualquer dispositivo</strong> (tablet, celular, TV…). Escaneie o QR no
            aparelho que vai ficar como totem, ou copie o link e abra nele.
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button size="sm" onClick={() => copy(totemUrl, "totem")}>
              {copied === "totem" ? <Check size={15} /> : <Copy size={15} />}
              {copied === "totem" ? "Link copiado!" : "Copiar link do totem"}
            </Button>
            <a href={totemUrl} target="_blank" rel="noopener noreferrer" className="w-full">
              <Button size="sm" variant="outline" className="w-full">
                <ExternalLink size={15} /> Abrir totem neste aparelho
              </Button>
            </a>
          </div>
          <p className="text-caption text-text-muted">Link secreto — não divulgue publicamente.</p>
        </div>
      )}

      {totemOn && totemUrl && <div className="h-px bg-border-subtle" />}

      {/* Painel de chamada */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-overline uppercase text-text-muted">
          <Tv size={14} /> Painel de chamada (TV)
        </div>
        <p className="text-caption text-text-2">Tela pública com as senhas — abra numa TV, tablet ou celular no balcão.</p>
        <Button size="sm" variant="outline" onClick={() => copy(painelUrl, "painel")}>
          {copied === "painel" ? <Check size={15} /> : <Copy size={15} />}
          {copied === "painel" ? "Link copiado!" : "Copiar link do painel"}
        </Button>
        <a href={painelUrl} target="_blank" rel="noopener noreferrer" className="w-full">
          <Button size="sm" variant="ghost" className="w-full">
            <ExternalLink size={15} /> Abrir painel neste aparelho
          </Button>
        </a>
      </div>
    </aside>
  );
}
