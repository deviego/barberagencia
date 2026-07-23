"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Play, Plus, Trash2, Scissors, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { ServiceTimer } from "@/components/service-timer";
import { formatBRL, cn } from "@/lib/utils";
import { startService, addComandaItem, removeComandaItem, finalizeComanda } from "@/features/admin/actions";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

interface Item {
  id: string;
  kind: string;
  name: string;
  price_brl: number;
  qty: number;
  covered_by_plan: boolean;
  duration_min: number;
}
interface Comanda {
  id: string;
  start_at: string;
  status: string;
  service_started_at: string | null;
  service_ended_at: string | null;
  clients: unknown;
  barbers: unknown;
  appointment_items: Item[] | null;
}
interface Service { id: string; name: string; price_brl: number; duration_min: number }
interface Product { id: string; name: string; price_brl: number }

const METHODS = [
  { value: "PIX", label: "PIX" },
  { value: "CARD_CREDIT", label: "Crédito" },
  { value: "CARD_DEBIT", label: "Débito" },
  { value: "CASH", label: "Dinheiro" },
];

function nameOf(c: Comanda) {
  return one(c.clients as { name: string }[] | { name: string })?.name ?? "Cliente";
}
function itemsOf(c: Comanda) {
  return c.appointment_items ?? [];
}
function totalOf(c: Comanda) {
  return itemsOf(c).reduce((s, i) => (i.covered_by_plan ? s : s + Number(i.price_brl) * i.qty), 0);
}

export function ComandaPanel({
  comandas,
  services,
  products,
}: {
  comandas: Comanda[];
  services: Service[];
  products: Product[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [method, setMethod] = useState("PIX");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selected = comandas.find((c) => c.id === selectedId) ?? null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erro");
      router.refresh();
    });
  }

  const active = comandas.filter((c) => c.status !== "DONE");
  const done = comandas.filter((c) => c.status === "DONE");

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-h3 font-bold text-text">Pedidos de hoje</h1>

      {comandas.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-muted">
          Nenhum atendimento confirmado para hoje.
        </p>
      )}

      {active.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((c) => {
            const inService = !!c.service_started_at;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border bg-surface p-4 text-left transition-colors hover:border-accent",
                  inService ? "border-2 border-accent" : "border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-body font-semibold text-text">{nameOf(c)}</span>
                  {inService ? <Badge variant="accent">Em atendimento</Badge> : <Badge variant="warning">Aguardando</Badge>}
                </div>
                <div className="text-caption text-text-muted tabular">
                  {format(new Date(c.start_at), "HH:mm", { locale: ptBR })} · {itemsOf(c).length} item(ns)
                </div>
                <div className="text-body font-bold text-accent tabular">{formatBRL(totalOf(c))}</div>
              </button>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-overline uppercase text-text-muted">Finalizados hoje</div>
          {done.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-4 py-3 text-left transition-colors hover:border-accent"
            >
              <span className="text-body text-text">{nameOf(c)}</span>
              <div className="flex items-center gap-3">
                <span className="text-caption text-text-muted tabular">{formatBRL(totalOf(c))}</span>
                <Badge variant="success">Atendido</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? `Pedido · ${nameOf(selected)}` : "Pedido"}
        footer={
          selected && selected.status !== "DONE" ? (
            selected.service_started_at ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMethod(m.value)}
                      className={cn(
                        "rounded-pill border px-3 py-1.5 text-caption transition-colors",
                        method === m.value ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <Button className="w-full" loading={pending} onClick={() => run(() => finalizeComanda(selected.id, method))}>
                  Finalizar e lançar {formatBRL(totalOf(selected))}
                </Button>
              </div>
            ) : (
              <Button className="w-full" loading={pending} onClick={() => run(() => startService(selected.id))}>
                <Play size={16} /> Iniciar atendimento
              </Button>
            )
          ) : undefined
        }
      >
        {selected && (
          <div className="flex flex-col gap-4">
            {selected.service_started_at && selected.status !== "DONE" && (
              <div className="rounded-md border border-accent bg-accent-wash p-3">
                <ServiceTimer
                  startedAt={selected.service_started_at}
                  estimateMin={itemsOf(selected).reduce((s, i) => s + (i.kind === "service" ? i.duration_min * i.qty : 0), 0)}
                />
              </div>
            )}

            {/* Itens */}
            <div className="flex flex-col gap-2">
              <div className="text-overline uppercase text-text-muted">Itens</div>
              {itemsOf(selected).map((it) => (
                <div key={it.id} className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-2">
                  <span className="flex items-center gap-2 text-body text-text">
                    {it.kind === "service" ? <Scissors size={14} className="text-accent" /> : <Package size={14} className="text-accent" />}
                    {it.qty > 1 ? `${it.qty}x ` : ""}
                    {it.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {it.covered_by_plan ? (
                      <span className="text-caption font-semibold text-accent">Plano</span>
                    ) : (
                      <span className="text-body tabular text-text">{formatBRL(Number(it.price_brl) * it.qty)}</span>
                    )}
                    {selected.status !== "DONE" && !it.covered_by_plan && (
                      <button
                        onClick={() => run(() => removeComandaItem(it.id))}
                        aria-label="Remover"
                        className="text-text-muted transition-colors hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border-subtle pt-2">
                <span className="text-body font-semibold text-text">Total no local</span>
                <span className="text-h5 font-bold text-accent tabular">{formatBRL(totalOf(selected))}</span>
              </div>
            </div>

            {/* Adicionar (só durante o atendimento) */}
            {selected.status !== "DONE" && (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="mb-1.5 text-overline uppercase text-text-muted">Adicionar serviço</div>
                  <div className="flex flex-wrap gap-2">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            addComandaItem(selected.id, {
                              kind: "service",
                              refId: s.id,
                              name: s.name,
                              priceBRL: s.price_brl,
                              qty: 1,
                              durationMin: s.duration_min,
                            })
                          )
                        }
                        className="flex items-center gap-1 rounded-pill border border-border px-3 py-1.5 text-caption text-text-2 transition-colors hover:border-accent hover:text-accent"
                      >
                        <Plus size={13} /> {s.name} · {formatBRL(s.price_brl)}
                      </button>
                    ))}
                  </div>
                </div>
                {products.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-overline uppercase text-text-muted">Adicionar produto</div>
                    <div className="flex flex-wrap gap-2">
                      {products.map((p) => (
                        <button
                          key={p.id}
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              addComandaItem(selected.id, {
                                kind: "product",
                                refId: p.id,
                                name: p.name,
                                priceBRL: p.price_brl,
                                qty: 1,
                              })
                            )
                          }
                          className="flex items-center gap-1 rounded-pill border border-border px-3 py-1.5 text-caption text-text-2 transition-colors hover:border-accent hover:text-accent"
                        >
                          <Plus size={13} /> {p.name} · {formatBRL(p.price_brl)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-caption text-danger">{error}</p>}
          </div>
        )}
      </Drawer>
    </div>
  );
}
