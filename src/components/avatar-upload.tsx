"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Foto de perfil com upload para o Storage (bucket `avatars`).
 * Faz o upload imediatamente e devolve a URL pública via `onChange`.
 * A persistência no banco fica a cargo do componente pai.
 */
export function AvatarUpload({
  current,
  fallback,
  folder,
  size = 56,
  onChange,
}: {
  current?: string | null;
  fallback: string;
  folder: string;
  size?: number;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const key = `${folder}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(key, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(key);
      setPreview(data.publicUrl);
      onChange(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative overflow-hidden rounded-full"
        style={{ width: size, height: size }}
        aria-label="Alterar foto"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Foto" className="h-full w-full object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center bg-accent font-bold text-text-inverse"
            style={{ fontSize: size / 2.6 }}
          >
            {fallback}
          </span>
        )}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100",
            busy && "opacity-100"
          )}
        >
          {busy ? <Loader2 size={size / 3} className="animate-spin" /> : <Camera size={size / 3} />}
        </span>
      </button>
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-caption font-semibold text-accent hover:underline"
        >
          Alterar foto
        </button>
        {error && <span className="text-caption text-danger">{error}</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handle} />
    </div>
  );
}
