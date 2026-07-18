"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MiniLoginPreview } from "@/features/platform/components/mini-login-preview";
import { THEME_TOKENS } from "@/features/platform/mock-data";

export default function TemasPage() {
  const [tokens, setTokens] = useState(THEME_TOKENS);
  const accent = tokens.find((t) => t.name === "--accent")?.value ?? "#C9A24B";

  function update(name: string, value: string) {
    setTokens((prev) => prev.map((t) => (t.name === name ? { ...t, value } : t)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 uppercase text-text">Editor de temas</h1>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setTokens(THEME_TOKENS)}>
            Reverter
          </Button>
          <Button>Publicar tema</Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
        {/* Tokens */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <div className="text-overline uppercase text-text-muted">
              Tokens — Barbearia Oliveira 01
            </div>
            <Badge variant="success">Publicado</Badge>
          </div>
          {tokens.map((t) => (
            <div key={t.name} className="flex items-center justify-between gap-3">
              <code className="text-caption text-text-2">{t.name}</code>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={t.value}
                  onChange={(e) => update(t.name, e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                />
                <input
                  value={t.value}
                  onChange={(e) => update(t.name, e.target.value)}
                  className="h-9 w-28 rounded-md border border-border bg-inset px-2 text-caption text-text tabular focus-visible:border-focus focus-visible:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Preview — login do tenant */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-overline uppercase text-text-muted">Preview — login do tenant</div>
          <MiniLoginPreview accent={accent} name="Barbearia Oliveira 01" logo="BO" />
        </div>
      </div>
    </div>
  );
}
