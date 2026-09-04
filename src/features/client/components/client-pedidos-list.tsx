"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Package, Plus, Scissors, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { StatusBadge, type AppointmentStatus } from "@/components/status-badge";
import { ServiceTimer } from "@/components/service-timer";
import { formatBRL, cn } from "@/lib/utils";
import { addComandaItemClient, removeComandaItemClient } from "@/features/client/actions";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

interface Item {
  id: string;
  kind: string;
  ref_id: string | null;
  name: string;
  price_brl: number;
  qty: number;
  covered_by_plan: boolean;
  duration_min: number;
}
interface Order {
  id: string;
  start_at: string;
  status: string;
  service_started_at: string | null;
  barbers: unknown;
  services: unknown;
  combo_plans: unknown;
  appointment_items: Item[] | null;
}
interface Service { id: string; name: string; price_brl: number; duration_min?: number }
interface Product { id: string; name: string; price_brl: number }

const EDITAVEL = ["REQUESTED", "CONFIRMED", "ALT_OFFERED"];

function itemsOf(o: Order) {
  return o.appointment_items ?? [];
}
function totalOf(o: Order) {
  return itemsOf(o).reduce((s, i) => (i.covered_by_plan ? s : s + Number(i.price_brl) * i.qty), 0);
}
function titleOf(o: Order) {
  const items = itemsOf(o);
  if (items.length) return items.map((i) => (i.qty > 1 ? `${i.qty}x ` : "") + i.name).join(", ");
  return (
    one(o.services as { name: string }[] | { name: string })?.name ??
    one(o.combo_plans as { name: string }[] | { name: string })?.name ??
    "Pedido"
  );
}

export function ClientPedidosList({
  orders,
  services,
  products,
}: {
  orders: Order[];
  services: Service[];
  products: Product[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erro");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-h3 font-bold text-text">Meus pedidos</h1>

      {orders.map((o) => {
        const inService = !!o.service_started_at && o.status !== "DONE";
        const editable = EDITAVEL.includes(o.status);
        return (
          <button
            key={o.id}
            onClick={() => setSelectedId(o.id)}
            className={cn(
              "flex flex-col gap-1 rounded-lg border bg-surface p-4 text-left transition-colors hover:border-accent",
              editable || inService ? "border-2 border-accent" : "border-border"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-body font-semibold text-text tabular">
                {format(new Date(o.start_at), "EEE, dd MMM · HH:mm", { locale: ptBR })}
              </span>
              {inService ? <Badge variant="accent">Em atendimento</Badge> : <StatusBadge status={o.status as AppointmentStatus} />}
            </div>
            <div className="truncate text-caption text-text-muted">{titleOf(o)}</div>
            <div className="flex items-center justify-between">
              <span className="text-body font-bold text-accent tabular">{formatBRL(totalOf(o))}</span>
              {editable && <span className="text-caption text-accent">Toque para adicionar itens</span>}
            </div>
          </button>
        );
      })}

      {orders.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-text-muted">
          Você ainda não tem pedidos.
        </p>
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? format(new Date(selected.start_at), "dd MMM · HH:mm", { locale: ptBR }) : "Pedido"}
      >
        {selected &&
          (() => {
            const items = itemsOf(selected);
            const inService = !!selected.service_started_at && selected.status !== "DONE";
            const editable = EDITAVEL.includes(selected.status);
            const estimate = items.reduce((s, i) => s + (i.kind === "service" ? i.duration_min * i.qty : 0), 0);
            const barber = one(selected.barbers as { name: string }[] | { name: string });
            return (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  {barber ? <span className="text-caption text-text-muted">com {barber.name}</span> : <span />}
                  {inService ? <Badge variant="accent">Em atendimento</Badge> : <StatusBadge status={selected.status as AppointmentStatus} />}
                </div>

                {inService && (
                  <div className="rounded-md border border-accent bg-accent-wash p-3">
                    <ServiceTimer startedAt={selected.service_started_at!} estimateMin={estimate} />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-body text-text-2">
                        {it.kind === "service" ? <Scissors size={14} className="text-accent" /> : <Package size={14} className="text-accent" />}
                        {it.qty > 1 ? `${it.qty}x ` : ""}
                        {it.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {it.covered_by_plan ? (
                          <span className="text-caption font-semibold text-accent">Plano · incluído</span>
                        ) : (
                          <span className="text-body tabular text-text">{formatBRL(Number(it.price_brl) * it.qty)}</span>
                        )}
                        {editable && !it.covered_by_plan && (
                          <button onClick={() => run(() => removeComandaItemClient(it.id))} aria-label="Remover" className="text-text-muted transition-colors hover:text-danger">
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

                {editable ? (
                  (() => {
                    // Itens já na comanda, indexados por ref_id, para marcar como selecionado.
                    const byRef = new Map(items.filter((i) => i.ref_id).map((i) => [i.ref_id as string, i]));
                    return (
                      <div className="flex flex-col gap-3">
                        <div>
                          <div className="mb-1.5 text-overline uppercase text-text-muted">Serviços</div>
                          <div className="flex flex-wrap gap-2">
                            {services.map((s) => {
                              const existing = byRef.get(s.id);
                              const active = !!existing;
                              return (
                                <button
                                  key={s.id}
                                  disabled={pending}
                                  onClick={() => {
                                    if (existing) {
                                      // Já selecionado → remove (o item coberto pelo plano não é removível).
                                      if (!existing.covered_by_plan) run(() => removeComandaItemClient(existing.id));
                                    } else {
                                      run(() =>
                                        addComandaItemClient(selected.id, { kind: "service", refId: s.id, name: s.name, priceBRL: s.price_brl, qty: 1, durationMin: s.duration_min ?? 0 })
                                      );
                                    }
                                  }}
                                  className={cn(
                                    "flex items-center gap-1 rounded-pill border px-3 py-1.5 text-caption transition-colors disabled:opacity-60",
                                    active
                                      ? "border-2 border-accent bg-accent-wash text-accent"
                                      : "border-border text-text-2 hover:border-accent hover:text-accent"
                                  )}
                                >
                                  {active ? <Check size={13} /> : <Plus size={13} />} {s.name} · {formatBRL(s.price_brl)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {products.length > 0 && (
                          <div>
                            <div className="mb-1.5 text-overline uppercase text-text-muted">Produtos</div>
                            <div className="flex flex-wrap gap-2">
                              {products.map((p) => {
                                const existing = byRef.get(p.id);
                                const active = !!existing;
                                return (
                                  <button
                                    key={p.id}
                                    disabled={pending}
                                    onClick={() => {
                                      if (existing) run(() => removeComandaItemClient(existing.id));
                                      else run(() => addComandaItemClient(selected.id, { kind: "product", refId: p.id, name: p.name, priceBRL: p.price_brl, qty: 1 }));
                                    }}
                                    className={cn(
                                      "flex items-center gap-1 rounded-pill border px-3 py-1.5 text-caption transition-colors disabled:opacity-60",
                                      active
                                        ? "border-2 border-accent bg-accent-wash text-accent"
                                        : "border-border text-text-2 hover:border-accent hover:text-accent"
                                    )}
                                  >
                                    {active ? <Check size={13} /> : <Plus size={13} />} {p.name} · {formatBRL(p.price_brl)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {error && <p className="text-caption text-danger">{error}</p>}
                        <p className="text-caption text-text-muted">
                          Toque para adicionar ou remover. O pagamento é feito no local após o atendimento.
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-caption text-text-muted">
                    {inService ? "Atendimento em andamento." : "Este pedido não pode mais ser alterado."}
                  </p>
                )}
              </div>
            );
          })()}
      </Drawer>
    </div>
  );
}
