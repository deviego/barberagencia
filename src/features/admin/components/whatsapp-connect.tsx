"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { maskPhoneBR } from "@/lib/masks";
import { waConnect, waLogout, waSend, waStatus } from "@/features/admin/whatsapp-actions";

type State = "connecting" | "qr" | "connected" | "disconnected" | "loading";

export function WhatsAppConnect() {
  const [state, setState] = useState<State>("loading");
  const [qr, setQr] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState<string | null>(null);
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
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling enquanto conectando/aguardando QR.
  useEffect(() => {
    if (state !== "qr" && state !== "connecting") {
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

  function sendTest() {
    setTestMsg(null);
    startTransition(async () => {
      const r = await waSend(testPhone);
      setTestMsg(r.ok ? "Mensagem de teste enviada!" : r.error ?? "Falha ao enviar.");
    });
  }

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
          <button onClick={refresh} className="flex items-center gap-1 text-caption text-accent hover:underline">
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>
      ) : state === "connecting" || state === "loading" ? (
        <div className="flex items-center gap-2 text-caption text-text-muted">
          <Loader2 size={16} className="animate-spin" /> {state === "loading" ? "Verificando conexão…" : "Gerando QR code…"}
        </div>
      ) : (
        <Button className="self-start" loading={pending} onClick={connect}>
          Conectar WhatsApp
        </Button>
      )}
    </section>
  );
}
