"use client";

/** Mini-mock do app do cliente que reage à cor de acento escolhida (preview ao vivo). */
export function MiniAppPreview({
  accent,
  name = "Barbearia",
  logo = "BB",
}: {
  accent: string;
  name?: string;
  logo?: string;
}) {
  return (
    <div className="w-[260px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md font-display text-caption font-black text-white"
          style={{ background: accent }}
        >
          {logo}
        </span>
        <span className="font-display text-caption font-extrabold uppercase text-text">{name}</span>
      </div>
      <div className="flex flex-col items-center gap-3 p-5">
        <div className="self-start text-body font-semibold text-text">Olá, William 👋</div>
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${accent} 75%, var(--bb-n700) 0)` }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-caption font-bold text-text">
            3/4
          </div>
        </div>
        <button
          className="w-full rounded-md py-2.5 font-display text-h5 uppercase text-white"
          style={{ background: accent }}
        >
          Agendar
        </button>
      </div>
    </div>
  );
}
