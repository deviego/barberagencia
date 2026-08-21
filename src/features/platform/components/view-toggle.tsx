"use client";

import Link from "next/link";
import { Orbit, LayoutDashboard } from "lucide-react";

/** Alterna entre a visão em Órbita (padrão) e o dashboard clássico do master. */
export function ViewToggle({ current }: { current: "orbita" | "classico" }) {
  const base = "flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-caption font-semibold transition-colors";
  return (
    <div className="flex items-center gap-1 rounded-pill border border-border bg-surface p-1">
      <Link href="/master" className={`${base} ${current === "orbita" ? "bg-accent text-text-inverse" : "text-text-2 hover:text-accent"}`}>
        <Orbit size={15} /> Órbita
      </Link>
      <Link
        href="/master?view=classico"
        className={`${base} ${current === "classico" ? "bg-accent text-text-inverse" : "text-text-2 hover:text-accent"}`}
      >
        <LayoutDashboard size={15} /> Modo clássico
      </Link>
    </div>
  );
}
