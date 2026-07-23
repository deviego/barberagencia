"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "./password-input";
import { updatePassword } from "../services/auth-service";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const STRENGTH_LABEL = ["—", "fraca", "boa", "forte"];
function pwStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

/** Passo 2 da recuperação: definir a nova senha (o link já criou a sessão). */
export function ResetPasswordForm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setChecking(false);
    });
  }, []);

  async function onSave() {
    setError(null);
    if (pw.length < 8 || pw !== pw2) {
      setError("As senhas devem coincidir e ter ao menos 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await updatePassword(pw);
      setDone(true);
      router.replace("/"); // já logado — o layout roteia por papel
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar a senha");
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-surface p-10 shadow-lg">
        <Loader2 className="animate-spin text-text-muted" size={22} />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 text-center shadow-lg">
        <p className="text-body text-text-2">
          Este link é inválido ou expirou. Abra o link mais recente no mesmo navegador ou solicite
          um novo.
        </p>
        <Link href="/recuperar-senha">
          <Button className="w-full">Solicitar novo link</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-7 shadow-lg">
      <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nova senha" autoComplete="new-password" />
      <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirmar nova senha" autoComplete="new-password" />
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("h-1 flex-1 rounded-full", i < pwStrength(pw) ? "bg-success" : "bg-n700")} />
        ))}
        <span className="text-[11px] text-text-muted">força: {STRENGTH_LABEL[pwStrength(pw)]}</span>
      </div>
      {error && <p className="text-caption text-danger">{error}</p>}
      <Button size="lg" loading={saving || done} onClick={onSave}>
        {done ? (
          <>
            <Check size={16} /> Senha alterada
          </>
        ) : (
          "Salvar nova senha e entrar"
        )}
      </Button>
    </div>
  );
}
