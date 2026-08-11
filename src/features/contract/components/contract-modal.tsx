"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ContractDocument } from "./contract-document";
import { signContract } from "../actions";
import { ACCEPT_TEXT } from "../parties";
import type { ContractView } from "../view";

const DISMISS_KEY = "bb_contract_modal_dismissed";

/** Modal do contrato após o teste (dismissível). Reaparece a cada nova sessão até assinar. */
export function ContractModal({ view }: { view: ContractView }) {
  const [visible, setVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState(view.signature.status === "SIGNED");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (view.signature.status === "SIGNED") return;
    const dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    if (!dismissed) setVisible(true);
  }, [view.signature.status]);

  if (!visible || done) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  function sign() {
    setError(null);
    startTransition(async () => {
      const res = await signContract();
      if (res.ok) {
        setDone(true);
        sessionStorage.setItem(DISMISS_KEY, "1");
      } else setError(res.error ?? "Falha ao assinar.");
    });
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-[720px] max-w-full flex-col rounded-lg border border-border bg-elevated shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <div>
            <h3 className="text-h5 font-bold text-text">Seu período de teste terminou</h3>
            <p className="text-caption text-text-muted">
              Confirme o contrato de assinatura para continuar usando a plataforma.
            </p>
          </div>
          <button onClick={dismiss} aria-label="Fechar" className="rounded-md p-1 text-text-muted hover:bg-inset hover:text-text">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {view.dataComplete ? (
            <ContractDocument fields={view.fields} signature={view.signature} />
          ) : (
            <p className="text-body text-text-2">
              Os dados da sua barbearia ainda estão sendo finalizados pelo suporte. Assim que estiverem
              completos, o contrato ficará disponível aqui para assinatura.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
          {view.dataComplete && (
            <button type="button" onClick={() => setAccepted((a) => !a)} className="flex items-start gap-2.5 text-left">
              <Checkbox checked={accepted} />
              <span className="text-caption text-text-2">{ACCEPT_TEXT}</span>
            </button>
          )}
          {error && <p className="text-caption text-danger">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={dismiss}>
              Agora não
            </Button>
            <Button onClick={sign} loading={pending} disabled={!accepted || !view.dataComplete}>
              <Check size={15} /> Li e aceito — assinar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
