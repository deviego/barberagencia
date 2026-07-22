"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/avatar-upload";
import { maskPhoneBR } from "@/lib/masks";
import { getInitials } from "@/lib/utils";
import { updateProfile } from "@/features/client/actions";

export function PerfilForm({
  userId,
  fullName,
  phone,
  email,
  avatarUrl,
}: {
  userId: string;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [tel, setTel] = useState(phone);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(nextAvatar = avatar) {
    setSaved(false);
    startTransition(async () => {
      const res = await updateProfile({ fullName: name, phone: tel, avatarUrl: nextAvatar });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="text-overline uppercase text-text-muted">Dados pessoais</div>
      <AvatarUpload
        current={avatar}
        fallback={getInitials(name, email)}
        folder={`profiles/${userId}`}
        size={64}
        onChange={(url) => {
          setAvatar(url);
          save(url); // persiste a foto imediatamente
        }}
      />
      <div className="flex flex-col gap-1.5">
        <Label>Nome completo</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Telefone</Label>
          <Input value={tel} onChange={(e) => setTel(maskPhoneBR(e.target.value))} inputMode="tel" maxLength={15} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>E-mail</Label>
          <Input value={email} disabled />
        </div>
      </div>
      <Button className="self-start" loading={pending} onClick={() => save()}>
        {saved ? (
          <>
            <Check size={16} /> Salvo
          </>
        ) : (
          "Salvar alterações"
        )}
      </Button>
    </section>
  );
}
