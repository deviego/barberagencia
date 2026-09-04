"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Drawer } from "@/components/ui/drawer";
import { formatBRL, cn } from "@/lib/utils";
import { savePlan, deletePlan } from "@/features/admin/actions";
import type { PlanManageRow } from "@/features/admin/data";

type ServiceOpt = { id: string; name: string };
const field = "h-10 w-full rounded-md border border-border bg-inset px-3 text-body text-text focus-visible:border-focus focus-visible:outline-none";

const blank = () => ({
  id: null as string | null,
  name: "",
  cuts: 4,
  scope: "",
  priceBrl: 0,
  bookingMode: "FLEXIBLE",
  forfeitOnNoshow: true,
  active: true,
  serviceIds: [] as string[],
  subscribers: [] as PlanManageRow["subscribers"],
});

export function PlanManager({ plans, services }: { plans: PlanManageRow[]; services: ServiceOpt[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ReturnType<typeof blank> | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nameById = new Map(services.map((s) => [s.id, s.name]));

  function openNew() {
    setError(null);
    setEditing(blank());
  }
  function openEdit(p: PlanManageRow) {
    setError(null);
    setEditing({ ...p, scope: p.scope ?? "" });
  }
  function patch(v: Partial<ReturnType<typeof blank>>) {
    setEditing((e) => (e ? { ...e, ...v } : e));
  }
  function toggleService(id: string) {
    setEditing((e) => {
      if (!e) return e;
      const has = e.serviceIds.includes(id);
      return { ...e, serviceIds: has ? e.serviceIds.filter((x) => x !== id) : [...e.serviceIds, id] };
    });
  }

  function save() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const res = await savePlan(
        editing.id,
        {
          name: editing.name,
          cuts: editing.cuts,
          scope: editing.scope,
          priceBrl: editing.priceBrl,
          bookingMode: editing.bookingMode,
          forfeitOnNoshow: editing.forfeitOnNoshow,
          active: editing.active,
        },
        editing.serviceIds
      );
      if (res.ok) {
        setEditing(null);
        router.refresh();
      } else setError(res.error);
    });
  }
  function remove() {
    if (!editing?.id) return;
    startTransition(async () => {
      await deletePlan(editing.id!);
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h5 font-bold text-text">Planos (combos)</h2>
        <Button size="sm" onClick={openNew}>
          <Plus size={15} /> Novo plano
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {plans.length === 0 && <p className="text-caption text-text-muted">Nenhum plano cadastrado.</p>}
        {plans.map((p) => (
          <button
            key={p.id}
            onClick={() => openEdit(p)}
            className={cn(
              "flex flex-col gap-2 rounded-lg border bg-surface p-4 text-left transition hover:border-accent",
              p.active ? "border-border" : "border-border-subtle opacity-60"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-body font-semibold text-text">{p.name}</span>
              <Badge variant={p.bookingMode === "FIXED" ? "info" : "neutral"}>{p.bookingMode === "FIXED" ? "Fixo" : "Livre"}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-muted">
              <span className="tabular">{p.cuts} usos/mês</span>
              <span className="tabular text-accent">{formatBRL(p.priceBrl)}/mês</span>
              <span className="flex items-center gap-1"><Scissors size={12} /> {p.serviceIds.length} serviço(s)</span>
              <span className="flex items-center gap-1"><Users size={12} /> {p.subscribers.length} cliente(s)</span>
            </div>
            {p.serviceIds.length > 0 && (
              <div className="truncate text-caption text-text-2">
                {p.serviceIds.map((id) => nameById.get(id) ?? "—").join(" · ")}
              </div>
            )}
          </button>
        ))}
      </div>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Editar plano" : "Novo plano"}
        footer={
          <div className="flex items-center justify-between gap-3">
            {editing?.id ? (
              <button onClick={remove} disabled={pending} className="text-caption text-danger hover:underline">
                Desativar
              </button>
            ) : <span />}
            <Button loading={pending} disabled={!editing?.name} onClick={save}>
              Salvar plano
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Nome do plano</Label>
              <Input value={editing.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ex.: Combo Corte + Barba" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Usos por mês</Label>
                <input type="number" min={0} value={editing.cuts} onChange={(e) => patch({ cuts: Number(e.target.value) })} className={field} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Preço (R$/mês)</Label>
                <input type="number" min={0} step="0.01" value={editing.priceBrl} onChange={(e) => patch({ priceBrl: Number(e.target.value) })} className={field} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Modo de agendamento</Label>
              <select value={editing.bookingMode} onChange={(e) => patch({ bookingMode: e.target.value })} className={field}>
                <option value="FLEXIBLE">Livre — cliente marca em qualquer horário</option>
                <option value="FIXED">Fixo — dia/horário/barbeiro fixos toda semana</option>
              </select>
            </div>

            {/* Serviços do combo (multi-select) */}
            <div className="flex flex-col gap-2">
              <Label className="mb-0">Serviços do combo (cobertos por visita)</Label>
              <p className="text-caption text-text-muted">Cada uso do plano cobre todos os serviços marcados numa visita.</p>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const on = editing.serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      className={cn(
                        "rounded-pill border px-3.5 py-1.5 text-caption transition-colors",
                        on ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
                      )}
                    >
                      {s.name}
                    </button>
                  );
                })}
                {services.length === 0 && <span className="text-caption text-text-muted">Cadastre serviços primeiro.</span>}
              </div>
              {editing.bookingMode === "FIXED" && editing.serviceIds.length > 0 && (
                <p className="text-caption text-text-muted">No modo fixo, o 1º serviço marcado é o reservado semanalmente.</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Escopo (rótulo, opcional)</Label>
              <Input value={editing.scope} onChange={(e) => patch({ scope: e.target.value })} placeholder="Ex.: cabelo+barba+sobrancelha" />
            </div>

            <label className="flex items-center gap-2">
              <Switch defaultChecked={editing.active} onChange={(v) => patch({ active: v })} />
              <span className="text-body text-text-2">Plano ativo</span>
            </label>
            {editing.bookingMode === "FIXED" && (
              <label className="flex items-center gap-2">
                <Switch defaultChecked={editing.forfeitOnNoshow} onChange={(v) => patch({ forfeitOnNoshow: v })} />
                <span className="text-body text-text-2">Perde o corte em caso de falta</span>
              </label>
            )}

            {error && <p className="text-caption text-danger">{error}</p>}

            {/* Clientes neste plano */}
            {editing.id && (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <div className="flex items-center gap-2 text-overline uppercase text-text-muted">
                  <Users size={14} /> Clientes neste plano ({editing.subscribers.length})
                </div>
                {editing.subscribers.length === 0 ? (
                  <p className="text-caption text-text-muted">Nenhum cliente ativo neste plano.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {editing.subscribers.map((c, i) => (
                      <li key={i} className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-2 text-caption">
                        <span className="text-text">{c.name}{c.phone ? <span className="text-text-muted"> · {c.phone}</span> : null}</span>
                        <span className="text-text-muted tabular">saldo {c.saldo}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
