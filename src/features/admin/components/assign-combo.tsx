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
  const [comboId, setComboId] = useState("");
  const [slot, setSlot] = useState<FixedSlot>({ weekday: 1, time: "09:00", barberId: "", serviceId: "" });
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const combo = combos.find((c) => c.id === comboId);
  const isFixed = combo?.booking_mode === "FIXED";

  function submit() {
    setError(null);
    if (!clientId || !comboId) return;
    if (isFixed && (!slot.barberId || !slot.serviceId || !slot.time)) {
      setError("Defina dia, horário, barbeiro e serviço.");
      return;
    }
    startTransition(async () => {
      const res = isFixed
        ? await activateFixedPlan(clientId, comboId, {
            weekday: slot.weekday,
            startMin: timeToMin(slot.time),
            barberId: slot.barberId,
            serviceId: slot.serviceId,
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
        Atribuir combo
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Atribuir combo a cliente"
        footer={
          <Button className="w-full" loading={pending} disabled={!clientId || !comboId} onClick={submit}>
            {ok ? (
              <>
                <Check size={16} /> Atribuído
              </>
            ) : isFixed ? (
              "Ativar plano fixo"
            ) : (
              "Atribuir combo"
            )}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Cliente</Label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={select}>
              <option value="">Selecione…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Combo</Label>
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
            <FixedSlotFields barbers={barbers} services={services} value={slot} onChange={setSlot} />
          ) : (
            <p className="text-caption text-text-muted">O saldo de cortes é definido pelo combo. Pagamento no local.</p>
          )}

          {error && <p className="text-caption text-danger">{error}</p>}
        </div>
      </Drawer>
    </>
  );
}
