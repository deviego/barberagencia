"use client";

/** Mini-mock da tela de LOGIN do tenant, reativo à cor de acento (preview do editor de temas). */
export function MiniLoginPreview({
  accent,
  name = "Barbearia Oliveira 01",
  logo = "BO",
}: {
  accent: string;
  name?: string;
  logo?: string;
}) {
  return (
    <div className="w-[260px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
      <div
        className="h-1.5"
        style={{
          background:
            "repeating-linear-gradient(-45deg, var(--bb-pole-red) 0 10px, var(--bb-pole-white) 10px 20px, var(--bb-pole-blue) 20px 30px)",
        }}
      />
      <div className="flex flex-col items-center gap-3 p-5">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-lg font-display text-h5 font-black text-white"
          style={{ background: accent }}
        >
          {logo}
        </span>
        <div className="text-center font-display text-caption font-extrabold uppercase leading-tight text-text">
          {name}
        </div>
        <div className="flex w-full flex-col gap-2">
          <div className="rounded-md border border-border bg-inset px-3 py-2 text-[11px] text-text-muted">
            E-mail
          </div>
          <div className="rounded-md border border-border bg-inset px-3 py-2 text-[11px] text-text-muted">
            Senha
          </div>
        </div>
        <button
          className="w-full rounded-md py-2 text-caption font-bold text-white"
          style={{ background: accent }}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}
