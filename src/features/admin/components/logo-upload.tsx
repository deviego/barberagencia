"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { saveBranding } from "@/features/admin/actions";

/** Envia o logo da barbearia para o Storage e salva a URL no branding. */
export function LogoUpload({ current, logoText }: { current: string | null; logoText: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const key = `branding/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(key, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(key);
      setPreview(data.publicUrl);
      startTransition(async () => {
        const res = await saveBranding({ logoUrl: data.publicUrl });
        if (res.ok) router.refresh();
        else setError(res.error);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload do logo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <LogoMark text={logoText} src={preview} size={56} className="rounded-lg" />
      <div className="flex flex-col gap-1">
        <Button variant="outline" size="sm" loading={busy || pending} onClick={() => inputRef.current?.click()}>
          Enviar logo
        </Button>
        <span className="text-caption text-text-muted">PNG ou JPG, fundo transparente de preferência.</span>
        {error && <span className="text-caption text-danger">{error}</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handle} />
    </div>
  );
}
