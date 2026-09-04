"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MessageCircle, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { maskPhoneBR } from "@/lib/masks";
import { waConnect, waLogout, waPair, waSend, waStatus } from "@/features/admin/whatsapp-actions";

type State = "connecting" | "qr" | "pairing" | "connected" | "disconnected" | "loading";

export function WhatsAppConnect() {
  const [state, setState] = useState<State>("loading");
  const [qr, setQr] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairPhone, setPairPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const polling = useRef(false);

  const refresh = useCallback(async () => {
    const s = await waStatus();
    if (!s.ok) {
      setError(s.error ?? "Erro");
      setState("disconnected");
      return;
    }
    setError(null);
    setState((s.status as State) ?? "disconnected");
    setQr(s.qr ?? null);
    setNumber(s.number ?? null);
    setPairingCode(s.pairingCode ?? null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling enquanto conectando/aguardando QR ou pareamento.
  useEffect(() => {
    if (state !== "qr" && state !== "connecting" && state !== "pairing") {
      polling.current = false;
      return;
    }
    polling.current = true;
    const t = setInterval(() => {
      if (polling.current) refresh();
    }, 2500);
    return () => clearInterval(t);
  }, [state, refresh]);

  function connect() {
    setError(null);
    startTransition(async () => {
      const s = await waConnect();
      if (!s.ok) return setError(s.error ?? "Erro");
      setState((s.status as State) ?? "connecting");
      setQr(s.qr ?? null);
      setNumber(s.number ?? null);
    });
  }

  function disconnect() {
    startTransition(async () => {
      await waLogout();
      setState("disconnected");
      setQr(null);
      setNumber(null);
    });
  }

  // "Conectar pelo número" — gera o código de pareamento (mesmo celular, sem QR).
  function pair() {
    setError(null);
    startTransition(async () => {
      const s = await waPair(pairPhone);
      if (!s.ok) return setError(s.error ?? "Erro");
      setState((s.status as State) ?? "connecting");
      setPairingCode(s.pairingCode ?? null);
      setNumber(s.number ?? null);
    });
  }

  // Encerra qualquer sessão presa (limpa creds no gateway) e pede um QR novo.
  function reset() {
    setError(null);
    startTransition(async () => {
      await waLogout();
      const s = await waConnect();
      if (!s.ok) return setError(s.error ?? "Erro");
      setState((s.status as State) ?? "connecting");
      setQr(s.qr ?? null);
      setNumber(s.number ?? null);
    });
  }

  function sendTest() {
    setTestMsg(null);
    startTransition(async () => {
      const r = await waSend(testPhone);
      setTestMsg(r.ok ? "Mensagem de teste enviada!" : r.error ?? "Falha ao enviar.");
    });
  }

  const pairBox = (
    <div className="w-full rounded-md border border-border-subtle bg-inset p-3">
      <div className="mb-2 flex items-center gap-1.5 text-caption font-semibold text-text-2">
        <Smartphone size={14} /> Só tem um celular? Conecte pelo número
      </div>
      <div className="flex gap-2">
        <Input
          value={pairPhone}
          onChange={(e) => setPairPhone(maskPhoneBR(e.target.value))}
          placeholder="(11) 91234-5678"
          inputMode="tel"
          maxLength={15}
        />
        <Button variant="secondary" loading={pending} onClick={pair}>
          Gerar código
        </Button>
      </div>
    </div>
  );

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-overline uppercase text-text-muted">
          <MessageCircle size={15} /> Conectar WhatsApp
        </div>
        {state === "connected" ? (
          <Badge variant="success">Conectado</Badge>
        ) : state === "loading" ? (
          <Badge variant="neutral">Carregando…</Badge>
        ) : (
          <Badge variant="warning">Desconectado</Badge>
        )}
      </div>

      <p className="text-caption text-text-muted">
        Conecte o WhatsApp da barbearia para os avisos (confirmação, lembretes, etc.) saírem pelo
        seu próprio número.
      </p>

      {error && <p className="text-caption text-danger">{error}</p>}

      {state === "connected" ? (
        <div className="flex flex-col gap-3">
          <p className="text-body text-text">
            Conectado{number ? ` · número ${number}` : ""}. ✅
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Enviar teste para</Label>
            <div className="flex gap-2">
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(maskPhoneBR(e.target.value))}
                placeholder="(11) 91234-5678"
                inputMode="tel"
                maxLength={15}
              />
              <Button variant="secondary" loading={pending} onClick={sendTest}>
                Enviar teste
              </Button>
            </div>
            {testMsg && <p className="text-caption text-text-2">{testMsg}</p>}
          </div>
          <button onClick={disconnect} disabled={pending} className="self-start text-caption font-medium text-danger hover:underline">
            Desconectar
          </button>
        </div>
      ) : state === "qr" && qr ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-caption text-text-2">
            Abra o WhatsApp no celular → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong> e escaneie:
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code do WhatsApp" className="h-56 w-56 rounded-lg border border-border bg-white p-2" />
          <div className="flex items-center gap-4">
            <button onClick={refresh} className="flex items-center gap-1 text-caption text-accent hover:underline">
              <RefreshCw size={13} /> Atualizar
            </button>
            <button onClick={reset} disabled={pending} className="flex items-center gap-1 text-caption text-text-muted hover:text-danger hover:underline">
              Recomeçar do zero
            </button>
          </div>
          {pairBox}
        </div>
      ) : state === "pairing" && pairingCode ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-caption text-text-2">
            No WhatsApp <strong>deste celular</strong>: Configurações → <strong>Aparelhos conectados</strong> →{" "}
            <strong>Conectar aparelho</strong> → <strong>Conectar com número de telefone</strong>. Digite o código:
          </p>
          <div className="rounded-lg border border-border bg-inset px-6 py-4 font-display text-h2 font-black tracking-[0.25em] text-accent">
            {pairingCode.slice(0, 4)}-{pairingCode.slice(4)}
          </div>
          <p className="text-caption text-text-muted">O código expira rápido. Se não funcionar, gere de novo.</p>
          <button onClick={reset} disabled={pending} className="flex items-center gap-1 text-caption text-text-muted hover:text-danger hover:underline">
            <RefreshCw size={13} /> Recomeçar
          </button>
        </div>
      ) : state === "connecting" || state === "loading" ? (
        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-2 text-caption text-text-muted">
            <Loader2 size={16} className="animate-spin" /> {state === "loading" ? "Verificando conexão…" : "Gerando QR code…"}
          </div>
          {state === "connecting" && (
            <button onClick={reset} disabled={pending} className="flex items-center gap-1 text-caption text-accent hover:underline">
              <RefreshCw size={13} /> Não aparece o QR? Recomeçar do zero
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-stretch gap-3">
          <Button className="self-start" loading={pending} onClick={connect}>
            Conectar por QR code
          </Button>
          {pairBox}
          <button onClick={reset} disabled={pending} className="self-start text-caption text-text-muted hover:text-accent hover:underline">
            Problemas para conectar? Recomeçar do zero
          </button>
        </div>
      )}
    </section>
  );
}
