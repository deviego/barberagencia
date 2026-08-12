"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Upload de imagem retangular para um bucket do Storage (ex.: `products`).
 * Sobe na hora e devolve a URL pública via `onChange`. Persistência fica no pai.
 */
export function ImageUpload({
  current,
  bucket,
  folder = "img",
  onChange,
}: {
  current?: string | null;
  bucket: string;
  folder?: string;
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
      const { error: upErr } = await supabase.storage.from(bucket).upload(key, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(key);
      setPreview(data.publicUrl);
      onChange(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setPreview(null);
    onChange("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-inset"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Foto do produto" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-text-muted">
            <ImagePlus size={22} />
            <span className="text-caption">Adicionar foto</span>
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
            <Loader2 size={22} className="animate-spin" />
          </span>
        )}
      </button>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} className="text-caption font-semibold text-accent hover:underline">
          {preview ? "Trocar foto" : "Enviar foto"}
        </button>
        {preview && (
          <button type="button" onClick={clear} className="flex items-center gap-1 text-caption text-text-muted hover:text-danger">
            <X size={13} /> Remover
          </button>
        )}
        {error && <span className="text-caption text-danger">{error}</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handle} />
    </div>
  );
}
