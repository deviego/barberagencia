"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { assignComboToClient } from "@/features/admin/actions";

interface Opt { id: string; name: string }

export function AssignCombo({ clients, combos }: { clients: Opt[]; combos: Opt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [comboId, setComboId] = useState("");
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);

  function submit() {
    if (!clientId || !comboId) return;
    startTransition(async () => {
      const res = await assignComboToClient(clientId, comboId);
      if (res.ok) {
        setOk(true);
        router.refresh();
        setTimeout(() => {
          setOk(false);
          setOpen(false);
        }, 1200);
      }
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
                </option>
              ))}
            </select>
          </div>
          <p className="text-caption text-text-muted">
            O saldo de cortes é definido pelo combo. Pagamento no local.
          </p>
        </div>
      </Drawer>
    </>
  );
}
