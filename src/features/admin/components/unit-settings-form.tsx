"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { maskPhoneBR } from "@/lib/masks";
import { saveUnitSettings } from "@/features/admin/actions";

export function UnitSettingsForm({
  tenantName,
  initial,
}: {
  tenantName: string;
  initial: {
    phone?: string | null;
    address?: string | null;
    hours_weekday?: string | null;
    hours_saturday?: string | null;
  } | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [hoursWeekday, setHoursWeekday] = useState(initial?.hours_weekday ?? "");
  const [hoursSaturday, setHoursSaturday] = useState(initial?.hours_saturday ?? "");
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveUnitSettings({ phone, address, hoursWeekday, hoursSaturday });
      if (res.ok) {
        setOk(true);
        router.refresh();
        setTimeout(() => setOk(false), 2000);
      } else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Nome da barbearia</Label>
          <Input value={tenantName} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Telefone / WhatsApp</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
            placeholder="(11) 91234-5678"
            inputMode="tel"
            maxLength={15}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Endereço</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro, cidade" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Horário — Seg. a Sex.</Label>
          <Input value={hoursWeekday} onChange={(e) => setHoursWeekday(e.target.value)} placeholder="09:00 – 20:00" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Horário — Sábado</Label>
          <Input value={hoursSaturday} onChange={(e) => setHoursSaturday(e.target.value)} placeholder="09:00 – 18:00" />
        </div>
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}

      <Button className="self-start" loading={pending} onClick={save}>
        {ok ? (
          <>
            <Check size={16} /> Salvo
          </>
        ) : (
          "Salvar dados da unidade"
        )}
      </Button>
    </div>
  );
}
