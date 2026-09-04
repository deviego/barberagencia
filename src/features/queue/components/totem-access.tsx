"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, MonitorSmartphone, Tv, ListOrdered, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Acesso ao totem, à fila do cliente (QR) e ao painel, a partir do admin.
 *  - Totem: QR para abrir o kiosk no aparelho que fica no balcão.
 *  - Fila (app): QR que o CLIENTE escaneia para entrar na fila, tirar a senha e
 *    acompanhar pelo próprio celular — disponível sempre que o modo app está ligado.
 *  - Painel: tela pública de chamada (TV). */
export function TotemAccess({
  totemUrl,
  totemQr,
  totemOn,
  filaUrl,
  filaQr,
  appOn,
  painelUrl,
}: {
  totemUrl: string | null;
  totemQr: string | null;
  totemOn: boolean;
  filaUrl: string;
  filaQr: string | null;
  appOn: boolean;
  painelUrl: string;
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
          {totemQr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={totemQr} alt="QR do totem" className="h-44 w-44 rounded-md border border-border" />
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

      {totemOn && totemUrl && appOn && <div className="h-px bg-border-subtle" />}

      {/* Fila do cliente (app) — QR público para o cliente entrar na fila */}
      {appOn && (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-1.5 text-overline uppercase text-text-muted">
            <ListOrdered size={14} /> Fila do cliente (QR)
          </div>
          {filaQr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={filaQr} alt="QR da fila do cliente" className="h-44 w-44 rounded-md border border-border" />
          )}
          <p className="text-caption text-text-2">
            Cole este QR no balcão. O cliente escaneia, <strong>entra na fila, tira a senha</strong> e acompanha
            a posição pelo próprio celular — sem precisar de totem.
          </p>
          <div className="flex w-full flex-col gap-2">
            {filaQr && (
              <a href={filaQr} download="qr-fila-cliente.png" className="w-full">
                <Button size="sm" className="w-full">
                  <Download size={15} /> Baixar QR da fila
                </Button>
              </a>
            )}
            <Button size="sm" variant="outline" onClick={() => copy(filaUrl, "fila")}>
              {copied === "fila" ? <Check size={15} /> : <Copy size={15} />}
              {copied === "fila" ? "Link copiado!" : "Copiar link da fila"}
            </Button>
          </div>
          <p className="text-caption text-text-muted">Link público — pode divulgar à vontade.</p>
        </div>
      )}

      {appOn && <div className="h-px bg-border-subtle" />}

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
