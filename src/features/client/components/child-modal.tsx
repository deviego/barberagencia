"use client";

import { useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/avatar-upload";
import { getInitials } from "@/lib/utils";
import { addChild } from "@/features/client/actions";

export interface Child {
  id: string;
  name: string;
  age: number | null;
  photo_url: string | null;
}

/** Modal para cadastrar uma criança (nome, idade e foto). */
export function ChildModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (child: Child) => void;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setAge("");
    setPhoto(null);
    setError(null);
  }

  function submit() {
    if (!name.trim()) return setError("Informe o nome da criança.");
    setError(null);
    startTransition(async () => {
      const res = await addChild({ name: name.trim(), age: age ? Number(age) : null, photoUrl: photo });
      if (res.ok) {
        onSaved(res.child as Child);
        reset();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-6"
      onClick={() => !pending && onClose()}
    >
      <div
        className="w-[420px] max-w-full rounded-lg border border-border bg-elevated p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-h4 font-semibold text-text">Registrar criança</h3>
        <p className="mt-1 text-caption text-text-muted">Para agendar o corte infantil da criança.</p>

        <div className="mt-4 flex flex-col gap-4">
          <AvatarUpload
            current={photo}
            fallback={getInitials(name || "C")}
            folder="children"
            size={64}
            onChange={(url) => setPhoto(url)}
          />
          <div className="flex flex-col gap-1.5">
            <Label>Nome da criança</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Miguel" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Idade</Label>
            <Input
              type="number"
              min={0}
              max={17}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Ex.: 7"
            />
          </div>
          {error && <p className="text-caption text-danger">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-border px-4 py-2 text-body text-text transition-colors hover:border-accent disabled:opacity-60"
          >
            Cancelar
          </button>
          <Button loading={pending} onClick={submit}>
            Salvar criança
          </Button>
        </div>
      </div>
    </div>
  );
}
