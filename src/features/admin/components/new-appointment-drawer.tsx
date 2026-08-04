"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatBRL, cn } from "@/lib/utils";
import { maskPhoneBR } from "@/lib/masks";
import { createAppointmentAdmin, createClientAdmin } from "@/features/admin/actions";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SLOT_MIN = 45;

interface ClientWithPlan {
  id: string;
  name: string;
  plan: { comboPlanId: string; name: string; saldo: number } | null;
}
interface Barber { id: string; name: string }
interface Service { id: string; name: string; price_brl: number; is_child_service?: boolean }
interface WorkingHour { barber_id: string; weekday: number; start_min: number; end_min: number }
interface Child { id: string; name: string; age: number | null }

export function NewAppointmentDrawer({
  clients,
  barbers,
  services,
  workingHours,
}: {
  clients: ClientWithPlan[];
  barbers: Barber[];
  services: Service[];
  workingHours: WorkingHour[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  // Clientes criados na hora (ainda não vêm na prop `clients` até o refresh).
  const [extraClients, setExtraClients] = useState<ClientWithPlan[]>([]);
  const [showFull, setShowFull] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const [barberId, setBarberId] = useState<string | null>(barbers[0]?.id ?? null);
  const [mode, setMode] = useState<"plan" | "service">("service");
  const [serviceId, setServiceId] = useState<string | null>(services[0]?.id ?? null);
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<string | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const [booked, setBooked] = useState<number[]>([]);

  const allClients = useMemo(() => {
    const byId = new Map<string, ClientWithPlan>();
    for (const c of [...clients, ...extraClients]) byId.set(c.id, byId.get(c.id) ?? c);
    return [...byId.values()];
  }, [clients, extraClients]);
  const client = allClients.find((c) => c.id === clientId) ?? null;
  const canUsePlan = !!client?.plan && client.plan.saldo > 0;
  const filteredClients = allClients
    .filter((c) => c.name.toLowerCase().includes(clientQuery.trim().toLowerCase()))
    .slice(0, 8);

  const newClientName = clientQuery.trim();
  function selectNewClient(c: { id: string; name: string }) {
    setExtraClients((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, { id: c.id, name: c.name, plan: null }]));
    setClientId(c.id);
    setClientQuery(c.name);
    setClientOpen(false);
    setShowFull(false);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setCreateErr(null);
  }
  function createSimple() {
    if (!newClientName) return;
    setCreateErr(null);
    startCreate(async () => {
      const res = await createClientAdmin({ name: newClientName });
      if (res.ok) selectNewClient(res.client);
      else setCreateErr(res.error);
    });
  }
  function createFull() {
    const nm = (newName || newClientName).trim();
    if (!nm) return setCreateErr("Informe o nome do cliente.");
    setCreateErr(null);
    startCreate(async () => {
      const res = await createClientAdmin({ name: nm, phone: newPhone || undefined, email: newEmail || undefined });
      if (res.ok) selectNewClient(res.client);
      else setCreateErr(res.error);
    });
  }
  // Corte infantil (serviço avulso marcado) → precisa escolher a criança.
  const needsChild = mode === "service" && !!services.find((s) => s.id === serviceId)?.is_child_service;

  // Carrega as crianças do cliente selecionado (para o corte infantil).
  useEffect(() => {
    if (!clientId) {
      setChildren([]);
      setChildId(null);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    let alive = true;
    supabase
      .from("children")
      .select("id, name, age")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (alive) setChildren((data as Child[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, [clientId]);

  // Ao trocar de cliente, escolhe automaticamente plano (se houver saldo) ou serviço.
  useEffect(() => {
    setMode(client?.plan && client.plan.saldo > 0 ? "plan" : "service");
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return { idx: i, wd: WEEKDAYS[d.getDay()], dd: d.getDate(), date: d };
    });
  }, []);

  const slots = useMemo(() => {
    const day = days[dayIdx]?.date;
    if (!day || !barberId) return [];
    const wd = day.getDay();
    const out: string[] = [];
    for (const w of workingHours.filter((x) => x.barber_id === barberId && x.weekday === wd)) {
      for (let t = w.start_min; t + SLOT_MIN <= w.end_min; t += SLOT_MIN) {
        out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
      }
    }
    return out.sort();
  }, [days, dayIdx, barberId, workingHours]);

  useEffect(() => {
    const day = days[dayIdx]?.date;
    if (!day || !barberId) {
      setBooked([]);
      return;
    }
    const from = new Date(day);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const supabase = createSupabaseBrowserClient();
    let alive = true;
    supabase
      .rpc("booked_starts", { p_barber_id: barberId, p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data }) => {
        if (alive) setBooked(((data as string[]) ?? []).map((s) => new Date(s).getTime()));
      });
    return () => {
      alive = false;
    };
  }, [days, dayIdx, barberId]);

  function isBooked(t: string) {
    const [h, m] = t.split(":").map(Number);
    const d = new Date(days[dayIdx].date);
    d.setHours(h, m, 0, 0);
    return booked.includes(d.getTime());
  }

  function submit() {
    setError(null);
    if (!clientId) return setError("Selecione um cliente.");
    if (!time) return setError("Selecione um horário.");
    if (needsChild && !childId) return setError("Selecione a criança para o corte infantil.");
    const usePlan = mode === "plan" && canUsePlan;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(days[dayIdx].date);
    d.setHours(h, m, 0, 0);
    startTransition(async () => {
      const res = await createAppointmentAdmin({
        clientId,
        barberId,
        serviceId: usePlan ? null : serviceId,
        comboPlanId: usePlan ? client!.plan!.comboPlanId : null,
        startAt: d.toISOString(),
        usePlan,
        childId: needsChild ? childId : null,
      });
      if (res.ok) {
        setOpen(false);
        setClientId("");
        setClientQuery("");
        setChildId(null);
        setTime(null);
        setExtraClients([]); // o refresh traz o cliente novo pela prop
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={15} />
        Novo agendamento
      </Button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Novo agendamento"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={submit}>
              Confirmar agendamento
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Cliente (busca + seleção) */}
          <div className="flex flex-col gap-1.5">
            <Label>Cliente</Label>
            <div className="relative">
              <input
                value={clientQuery}
                onChange={(e) => {
                  setClientQuery(e.target.value);
                  setClientId("");
                  setClientOpen(true);
                }}
                onFocus={() => setClientOpen(true)}
                placeholder="Insira o nome do cliente"
                className="w-full rounded-md border border-border bg-inset px-3 py-2 text-body text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
              {clientOpen && clientQuery.trim() && !clientId && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setClientOpen(false)} />
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
                    {filteredClients.length > 0 ? (
                      filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setClientId(c.id);
                            setClientQuery(c.name);
                            setClientOpen(false);
                          }}
                          className="block w-full px-3 py-2.5 text-left text-body text-text transition-colors hover:bg-accent-wash"
                        >
                          {c.name}
                          {c.plan ? (
                            <span className="text-caption text-text-muted"> · plano {c.plan.saldo} cortes</span>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2.5 text-caption text-text-muted">Nenhum cliente encontrado.</p>
                    )}
                    {/* Criar cliente — sempre disponível (por último), permite nome repetido */}
                    <div className="flex flex-col gap-2 border-t border-border-subtle p-2">
                      {newClientName && (
                        <button
                          type="button"
                          onClick={createSimple}
                          disabled={creating}
                          className="flex items-center gap-2 rounded-md border border-accent bg-accent-wash px-3 py-2 text-left text-body font-semibold text-accent transition-colors hover:brightness-95 disabled:opacity-60"
                        >
                          <Plus size={15} /> Criar “{newClientName}” (novo cliente)
                        </button>
                      )}
                      {!showFull ? (
                        <button
                          type="button"
                          onClick={() => {
                            setNewName(newClientName);
                            setShowFull(true);
                          }}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-body font-semibold text-text-2 transition-colors hover:border-accent hover:text-accent"
                        >
                          Cadastro completo (nome, telefone, e-mail)
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2 border-t border-border-subtle pt-2">
                          <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Nome completo"
                            className="w-full rounded-md border border-border bg-inset px-3 py-2 text-body text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
                          />
                          <input
                            value={newPhone}
                            onChange={(e) => setNewPhone(maskPhoneBR(e.target.value))}
                            inputMode="tel"
                            maxLength={15}
                            placeholder="Telefone (opcional)"
                            className="w-full rounded-md border border-border bg-inset px-3 py-2 text-body text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
                          />
                          <input
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            type="email"
                            placeholder="E-mail (opcional)"
                            className="w-full rounded-md border border-border bg-inset px-3 py-2 text-body text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
                          />
                          <Button size="sm" loading={creating} onClick={createFull}>
                            Criar cliente
                          </Button>
                        </div>
                      )}
                      {createErr && <p className="px-1 text-caption text-danger">{createErr}</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
            {client && (
              <p className="text-caption text-accent">
                Selecionado: <strong>{client.name}</strong>
              </p>
            )}
          </div>

          {/* Vínculo: plano ou serviço */}
          {client && (
            <div className="flex flex-col gap-2">
              <Label className="mb-0">Vínculo</Label>
              <div className="flex gap-2">
                {canUsePlan && (
                  <Chip active={mode === "plan"} onClick={() => setMode("plan")}>
                    Plano · {client.plan!.name} ({client.plan!.saldo})
                  </Chip>
                )}
                <Chip active={mode === "service"} onClick={() => setMode("service")}>
                  Serviço avulso
                </Chip>
              </div>
              {client.plan && !canUsePlan && (
                <p className="text-caption text-text-muted">Plano sem saldo — será um serviço avulso.</p>
              )}
            </div>
          )}

          {/* Serviço (quando avulso) */}
          {mode === "service" && (
            <div className="flex flex-col gap-2">
              <Label className="mb-0">Serviço</Label>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => (
                  <Chip key={s.id} active={serviceId === s.id} onClick={() => setServiceId(s.id)}>
                    {s.name} · {formatBRL(s.price_brl)}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Criança (corte infantil) */}
          {needsChild && (
            <div className="flex flex-col gap-2">
              <Label className="mb-0">Criança (corte infantil)</Label>
              {!clientId ? (
                <p className="text-caption text-text-muted">Selecione o cliente primeiro.</p>
              ) : children.length === 0 ? (
                <p className="text-caption text-warning-strong">
                  Este cliente não tem criança cadastrada. Peça para cadastrar no app (Perfil → Minhas crianças).
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {children.map((c) => (
                    <Chip key={c.id} active={childId === c.id} onClick={() => setChildId(c.id)}>
                      {c.name}
                      {c.age != null ? ` · ${c.age} anos` : ""}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Barbeiro */}
          <div className="flex flex-col gap-2">
            <Label className="mb-0">Barbeiro</Label>
            <div className="flex flex-wrap gap-2">
              {barbers.map((b) => (
                <Chip key={b.id} active={barberId === b.id} onClick={() => setBarberId(b.id)}>
                  {b.name}
                </Chip>
              ))}
            </div>
          </div>

          {/* Dia */}
          <div className="flex flex-col gap-2">
            <Label className="mb-0">Data</Label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => (
                <button
                  key={d.idx}
                  onClick={() => {
                    setDayIdx(d.idx);
                    setTime(null);
                  }}
                  className={cn(
                    "flex min-w-[52px] flex-col items-center rounded-md border px-3 py-2 transition-colors tabular",
                    dayIdx === d.idx ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
                  )}
                >
                  <span className="text-caption">{d.wd}</span>
                  <span className="text-h5 font-bold">{d.dd}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Horário */}
          <div className="flex flex-col gap-2">
            <Label className="mb-0">Horário</Label>
            {slots.length === 0 ? (
              <p className="text-caption text-text-muted">Sem horários para este barbeiro neste dia.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((t) => {
                  const occupied = isBooked(t);
                  return (
                    <button
                      key={t}
                      disabled={occupied}
                      onClick={() => setTime(t)}
                      className={cn(
                        "rounded-md border py-2 text-body tabular transition-colors",
                        occupied
                          ? "cursor-not-allowed border-border-subtle text-text-muted line-through opacity-60"
                          : time === t
                            ? "border-2 border-accent bg-accent-wash text-accent"
                            : "border-border text-text hover:border-accent"
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-caption text-danger">{error}</p>}
        </div>
      </Drawer>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill border px-4 py-2 text-body transition-colors",
        active ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
      )}
    >
      {children}
    </button>
  );
}
