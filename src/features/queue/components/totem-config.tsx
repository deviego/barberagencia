"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonitorSmartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { setQueueMode, setQueuePlanRequiresService } from "../totem-actions";

type Mode = "TOTEM" | "APP" | "BOTH";

const MODES: { key: Mode; label: string; desc: string }[] = [
  { key: "APP", label: "App / QR", desc: "Padrão — cliente pega a senha pelo próprio celular" },
  { key: "TOTEM", label: "Totem", desc: "Se você tem um totem no balcão (identifica por telefone)" },
  { key: "BOTH", label: "Ambos", desc: "App e totem disponíveis" },
];

/** Seção "Fila / Totem" nas Configurações do admin: modo da fila e regra do plano. O acesso do
 * totem fica no bloco próprio "Totem — só no tablet" (TotemTablet, #102). */
export function TotemConfig({
  mode: initialMode,
  planRequiresService,
}: {
  mode: Mode;
  planRequiresService: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pending, startTransition] = useTransition();

  function changeMode(m: Mode) {
    setMode(m);
    startTransition(async () => {
      await setQueueMode(m);
      // O bloco "Totem — só no tablet" aparece ou some conforme o modo salvo.
      router.refresh();
    });
  }
  function togglePlan(v: boolean) {
    startTransition(async () => {
      await setQueuePlanRequiresService(v);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <MonitorSmartphone size={16} className="text-text-muted" />
        <div className="text-overline uppercase text-text-muted">Fila / Totem</div>
      </div>

      {/* Modo da fila */}
      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-text-2">Como os clientes entram na fila</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => changeMode(m.key)}
              disabled={pending}
              className={`flex flex-col gap-0.5 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                mode === m.key ? "border-accent bg-accent-wash" : "border-border hover:border-accent"
              }`}
            >
              <span className="text-body font-semibold text-text">{m.label}</span>
              <span className="text-caption text-text-muted">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Flag: plano também escolhe serviço */}
      <div className="flex items-center justify-between border-t border-border-subtle pt-4">
        <div>
          <div className="text-body font-semibold text-text">Cliente de plano também escolhe serviço</div>
          <div className="text-caption text-text-muted">Se desligado, o cliente com plano pula a escolha de serviço no totem.</div>
        </div>
        <Switch defaultChecked={planRequiresService} onChange={togglePlan} />
      </div>

      {mode === "APP" && (
        <Badge variant="neutral">Totem desativado — clientes usam o app/QR pelo celular.</Badge>
      )}
    </section>
  );
}
