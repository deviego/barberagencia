"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Play, Check, X, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { callQueue, startQueue, finishQueue, removeQueue } from "../actions";
import type { AdminQueueItem } from "../data";

/** Painel da fila no admin: ordem de chegada + ações (chamar/iniciar/concluir/remover). */
export function AdminFila({ items }: { items: AdminQueueItem[] }) {
  const router = useRouter();
  const [pending, startT] = useTransition();

  // Atualiza a fila periodicamente (novas senhas entram sozinhas).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 12000);
    return () => clearInterval(t);
  }, [router]);

  function run(fn: () => Promise<unknown>) {
    startT(async () => {
      await fn();
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-border-subtle px-4 py-10 text-center text-caption text-text-muted">
        Ninguém na fila agora.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <div key={it.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <span className="font-display text-h4 font-black text-accent tabular">#{it.ticket}</span>
          <div className="min-w-0">
            <div className="truncate text-body font-semibold text-text">{it.clientName}</div>
            <div className="truncate text-caption text-text-muted">
              {it.service ?? "Serviço a definir"}
              {it.barber ? ` · ${it.barber}` : ""}
            </div>
          </div>
          <Badge variant={it.status === "IN_SERVICE" ? "success" : "warning"} className="ml-auto">
            {it.status === "IN_SERVICE" ? "Em atendimento" : "Aguardando"}
          </Badge>

          {it.status === "WAITING" ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => run(() => callQueue(it.id))} disabled={pending}>
                <Bell size={14} /> Chamar
              </Button>
              <Button size="sm" onClick={() => run(() => startQueue(it.id))} loading={pending}>
                <Play size={14} /> Iniciar
              </Button>
              <Button size="sm" variant="outline" onClick={() => run(() => removeQueue(it.id))} disabled={pending}>
                <X size={14} />
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => run(() => finishQueue(it.id))} loading={pending}>
              <Check size={14} /> Concluir
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
