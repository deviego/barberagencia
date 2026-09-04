"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift } from "lucide-react";
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
  booking_mode?: string;
}

export function AssignCombo({
  clients,
  combos,
  barbers,
  services,
}: {
  clients: Opt[];
  combos: ComboOpt[];
  barbers: Opt[];
  services: Opt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [comboId, setComboId] = useState("");
  const [slot, setSlot] = useState<FixedSlot>({ weekday: 1, time: "09:00", barberId: "" });
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const combo = combos.find((c) => c.id === comboId);
  const isFixed = combo?.booking_mode === "FIXED";
  const selectedClient = clients.find((c) => c.id === clientId);
  const filteredClients = (clientQuery.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(clientQuery.trim().toLowerCase()))
    : clients
  ).slice(0, 8);

  function submit() {
    setError(null);
    if (!clientId || !comboId) return;
    if (isFixed && (!slot.barberId || !slot.time)) {
      setError("Defina dia, horário e barbeiro.");
      return;
    }
    startTransition(async () => {
      const res = isFixed
        ? await activateFixedPlan(clientId, comboId, {
            weekday: slot.weekday,
            startMin: timeToMin(slot.time),
            barberId: slot.barberId,
          })
        : await assignComboToClient(clientId, comboId);
      if (res.ok) {
        setOk(true);
        router.refresh();
        setTimeout(() => {
          setOk(false);
          setOpen(false);
        }, 1200);
      } else setError(res.error);
    });
  }

  const select = "h-10 rounded-md border border-border bg-inset px-3 text-body text-text focus-visible:border-focus focus-visible:outline-none";

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Gift size={16} />
        Atribuir plano
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Atribuir plano a cliente"
        footer={
          <Button className="w-full" loading={pending} disabled={!clientId || !comboId} onClick={submit}>
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
        }
      >
        <div className="flex flex-col gap-4">
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
          <div className="flex flex-col gap-1.5">
            <Label>Plano</Label>
            <select value={comboId} onChange={(e) => setComboId(e.target.value)} className={select}>
              <option value="">Selecione…</option>
              {combos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.booking_mode === "FIXED" ? " · fixo" : ""}
                </option>
              ))}
            </select>
          </div>

          {isFixed ? (
            <FixedSlotFields barbers={barbers} value={slot} onChange={setSlot} />
          ) : (
            <p className="text-caption text-text-muted">O saldo de cortes é definido pelo combo. Pagamento no local.</p>
          )}

          {error && <p className="text-caption text-danger">{error}</p>}
        </div>
      </Drawer>
    </>
  );
}
