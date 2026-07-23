"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

/** Cronômetro ao vivo (conta desde `startedAt`). Mostra tempo estimado se informado. */
export function ServiceTimer({ startedAt, estimateMin }: { startedAt: string; estimateMin?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const hh = Math.floor(elapsedSec / 3600);
  const mm = Math.floor((elapsedSec % 3600) / 60);
  const ss = elapsedSec % 60;
  const label =
    (hh > 0 ? `${String(hh).padStart(2, "0")}:` : "") +
    `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const over = estimateMin ? elapsedSec > estimateMin * 60 : false;

  return (
    <div className="flex items-center gap-2">
      <Timer size={16} className={over ? "text-danger" : "text-accent"} />
      <span className={`text-h5 font-bold tabular ${over ? "text-danger" : "text-text"}`}>{label}</span>
      {estimateMin ? <span className="text-caption text-text-muted">/ ~{estimateMin} min</span> : null}
    </div>
  );
}
