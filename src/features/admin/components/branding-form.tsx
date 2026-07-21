"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { saveBranding } from "@/features/admin/actions";

const PRESETS = ["#C9A24B", "#5556EE", "#08D48B", "#FF385C"];

export function BrandingForm({
  initialAccent,
  initialInstagram,
}: {
  initialAccent: string;
  initialInstagram: string;
}) {
  const router = useRouter();
  const [accent, setAccent] = useState(initialAccent || "#C9A24B");
  const [instagram, setInstagram] = useState(initialInstagram || "");
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);

  function save() {
    startTransition(async () => {
      const res = await saveBranding({ accent, instagram });
      if (res.ok) {
        setOk(true);
        router.refresh();
        setTimeout(() => setOk(false), 2000);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Cor de acento</Label>
        <div className="flex items-center gap-2">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              aria-label={`Cor ${c}`}
              className={`h-9 w-9 rounded-md border-2 ${accent.toLowerCase() === c.toLowerCase() ? "border-text" : "border-transparent"}`}
              style={{ background: c }}
            />
          ))}
          <span className="mx-1 h-6 w-px bg-border" />
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-9 w-10 cursor-pointer rounded border border-border bg-transparent"
          />
          <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="w-28" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Instagram</Label>
        <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@barbearia" />
      </div>
      <Button className="self-start" loading={pending} onClick={save}>
        {ok ? (
          <>
            <Check size={16} /> Salvo
          </>
        ) : (
          "Salvar branding"
        )}
      </Button>
    </div>
  );
}
