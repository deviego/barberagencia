"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { activateFixedPlan, assignComboToClient } from "@/features/admin/actions";
import { FixedSlotFields, timeToMin, type FixedSlot } from "@/features/admin/components/fixed-slot-fields";

interface Opt {
  id: string;
  name: string;
}
interface ComboOpt extends Opt {
  booking_mode?: string | null;
}

/** Plano ativo do cliente pré-escolhido: com ele, confirmar pede o aviso de substituição antes. */
export interface CurrentPlan {
  name: string;
  saldo: number;
  fixed: boolean;
  /** Horários fixos marcados a partir de agora (a troca de plano os cancela). */
  futureFixed: number;
}

const FAILED = "Não deu certo. Tente de novo.";

function replaceWarning(clientName: string, current: CurrentPlan) {
  if (current.fixed && current.futureFixed > 0) {
    const n = current.futureFixed;
    const slots =
      n === 1
        ? "o horário fixo já marcado deste plano será cancelado e o horário do barbeiro fica livre"
        : `os ${n} horários fixos já marcados deste plano serão cancelados e o horário do barbeiro fica livre`;
    return `${clientName} já tem o plano ${current.name}. Se trocar, ${slots}. Atendimentos já feitos não mudam, e o saldo passa a ser o do plano novo.`;
  }
  if (current.fixed) {
    return `${clientName} já tem o plano ${current.name}. Se trocar, o plano novo substitui o atual e o saldo passa a ser o do plano novo.`;
  }
  const cuts = current.saldo === 1 ? "1 corte" : `${current.saldo} cortes`;
  return `${clientName} já tem o plano ${current.name}, com ${cuts} de saldo. Se trocar, o plano novo substitui o atual e o saldo passa a ser o do plano novo.`;
}

/**
 * Atribuir plano (combo ou plano fixo) a um cliente.
 * - Sem `client`: botão do topo da lista de Clientes, com busca de cliente (como antes).
 * - Com `client` (ficha do cliente, #130): cliente já escolhido, sem busca. Se ele tem `current`,
 *   confirmar mostra o aviso de substituição e só troca no "Sim, trocar plano".
 */
export function AssignCombo({
  clients = [],
  combos,
  barbers,
  client,
  current = null,
  triggerLabel = "Atribuir plano",
  triggerSize,
  onDone,
}: {
  clients?: Opt[];
  combos: ComboOpt[];
  barbers: Opt[];
  /** Mantido por compatibilidade com a lista de Clientes; o serviço vem do plano. */
  services?: Opt[];
  client?: Opt;
  current?: CurrentPlan | null;
  triggerLabel?: string;
  triggerSize?: "sm" | "md";
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(client?.id ?? "");
  const [clientQuery, setClientQuery] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [comboId, setComboId] = useState("");
  const [slot, setSlot] = useState<FixedSlot>({ weekday: 1, time: "09:00", barberId: "" });
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixedClient = !!client;
  const targetId = fixedClient ? client.id : clientId;
  const combo = combos.find((c) => c.id === comboId);
  const isFixed = combo?.booking_mode === "FIXED";
  const noCombos = combos.length === 0;
  const selectedClient = clients.find((c) => c.id === clientId);
  const filteredClients = (clientQuery.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(clientQuery.trim().toLowerCase()))
    : clients
  ).slice(0, 8);

  function openDrawer() {
    setComboId("");
    setConfirmReplace(false);
    setError(null);
    setOk(false);
    if (fixedClient) setClientId(client.id);
    setOpen(true);
  }

  function validate(): boolean {
    setError(null);
    if (!targetId || !comboId) return false;
    if (isFixed && (!slot.barberId || !slot.time)) {
      setError("Defina dia, horário e barbeiro.");
      return false;
    }
    return true;
  }

  function submit() {
    if (!validate()) return;
    if (current && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    send();
  }

  function send() {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        const res = isFixed
          ? await activateFixedPlan(targetId, comboId, {
              weekday: slot.weekday,
              startMin: timeToMin(slot.time),
              barberId: slot.barberId,
            })
          : await assignComboToClient(targetId, comboId);
        if (res.ok) {
          setOk(true);
          setConfirmReplace(false);
          onDone?.();
          router.refresh();
          setTimeout(() => {
            setOk(false);
            setOpen(false);
          }, 1200);
        } else {
          setConfirmReplace(false);
          setError(res.error || FAILED);
        }
      } catch {
        // Sem conexão: o que foi escolhido continua na gaveta e o botão volta a funcionar.
        setConfirmReplace(false);
        setError(FAILED);
      } finally {
        inFlight.current = false;
      }
    });
  }

  const select = "h-11 rounded-md border border-border bg-inset px-3 text-body text-text focus-visible:border-focus focus-visible:outline-none";
  const title = fixedClient ? `Atribuir plano a ${client.name}` : "Atribuir plano a cliente";

  const footer =
    confirmReplace && current && fixedClient ? (
      <div role="alertdialog" aria-label="Trocar plano" className="flex flex-col gap-3">
        <p className="flex items-start gap-2 text-caption text-warning-strong">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {replaceWarning(client.name, current)}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:flex-1" loading={pending} onClick={send}>
            {ok ? (
              <>
                <Check size={16} /> Atribuído
              </>
            ) : (
              "Sim, trocar plano"
            )}
          </Button>
          <Button className="w-full sm:flex-1" variant="ghost" disabled={pending} onClick={() => setConfirmReplace(false)}>
            Voltar
          </Button>
        </div>
      </div>
    ) : (
      <Button className="w-full" loading={pending} disabled={noCombos || !targetId || !comboId} onClick={submit}>
        {ok ? (
          <>
            <Check size={16} /> Atribuído
          </>
        ) : isFixed ? (
          "Ativar plano fixo"
        ) : (
          "Atribuir plano"
        )}
      </Button>
    );

  return (
    <>
      <Button variant="outline" size={triggerSize} onClick={openDrawer}>
        <Gift size={16} aria-hidden />
        {triggerLabel}
      </Button>
      <Drawer open={open} onClose={() => !pending && setOpen(false)} title={title} footer={footer}>
        <div className="flex flex-col gap-4">
          {!fixedClient && (
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
                  placeholder="Busque pelo nome do cliente"
                  className={`${select} w-full`}
                />
                {clientOpen && !clientId && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setClientOpen(false)} />
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
                      {filteredClients.length === 0 ? (
                        <p className="px-3 py-2.5 text-caption text-text-muted">Nenhum cliente encontrado.</p>
                      ) : (
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
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              {selectedClient && (
                <p className="text-caption text-accent">
                  Selecionado: <strong>{selectedClient.name}</strong>
                </p>
              )}
            </div>
          )}

          {noCombos ? (
            <p role="status" className="rounded-md border border-border-subtle bg-inset px-3 py-2.5 text-caption text-text-2">
              Nenhum plano cadastrado. Crie um em Planos.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-combo-plan">Plano</Label>
              <select
                id="assign-combo-plan"
                value={comboId}
                disabled={pending || confirmReplace}
                onChange={(e) => {
                  setComboId(e.target.value);
                  setError(null);
                }}
                className={select}
              >
                <option value="">Selecione…</option>
                {combos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.booking_mode === "FIXED" ? " · fixo" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!noCombos &&
            (isFixed ? (
              <FixedSlotFields barbers={barbers} value={slot} onChange={setSlot} />
            ) : (
              <p className="text-caption text-text-muted">O saldo de cortes é definido pelo combo. Pagamento no local.</p>
            ))}

          {error && (
            <p role="alert" className="text-caption text-danger">
              {error}
            </p>
          )}
        </div>
      </Drawer>
    </>
  );
}
