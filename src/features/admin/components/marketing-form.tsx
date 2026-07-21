"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createCampaign } from "@/features/admin/actions";

const SEGMENTS = ["Inativos 60+ dias", "Assinantes", "Avulsos", "Aniversariantes"];

export function MarketingForm({ canSegmented }: { canSegmented: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState(SEGMENTS[0]);
  const [message, setMessage] = useState("Sentimos sua falta! Que tal agendar seu próximo corte com 10% off? 💈");
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createCampaign({ name, segment, message });
      if (res.ok) {
        setOk(true);
        setName("");
        router.refresh();
        setTimeout(() => setOk(false), 2000);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="text-overline uppercase text-text-muted">Criar campanha</div>
      <div className="flex flex-col gap-1.5">
        <Label>Nome da campanha</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Sentimos sua falta!" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Segmento</Label>
        <div className="flex flex-wrap gap-2">
          {SEGMENTS.map((s, i) => {
            const locked = !canSegmented && i > 1;
            return (
              <button
                key={s}
                disabled={locked}
                onClick={() => setSegment(s)}
                className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-caption transition-colors ${
                  segment === s ? "border-2 border-accent bg-accent-wash text-accent" : locked ? "border-border-subtle text-text-muted" : "border-border text-text-2 hover:border-accent"
                }`}
              >
                {locked && <Lock size={12} />}
                {s}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Mensagem</Label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="rounded-md border border-border bg-inset p-3 text-body text-text focus-visible:border-focus focus-visible:outline-none"
        />
      </div>
      <div className="flex items-center justify-end">
        <Button loading={pending} onClick={submit}>
          {ok ? (
            <>
              <Check size={16} /> Criada
            </>
          ) : (
            "Criar campanha"
          )}
        </Button>
      </div>
    </div>
  );
}
