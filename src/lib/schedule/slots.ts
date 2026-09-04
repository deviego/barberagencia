/**
 * Motor único de geração de horários da agenda (client + server).
 * Regra de negócio: os slots vão do início até o FECHAMENTO inclusive
 * (`t <= endMin`), permitindo que o serviço passe do fim do expediente —
 * quem decide atender é a barbearia. Passo padrão de 30 min.
 */

export interface SlotWindow {
  startMin: number;
  endMin: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const hhmmToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** True se `t` (min) cai dentro de alguma janela bloqueada. */
function inBlocked(t: number, blocked: SlotWindow[]) {
  return blocked.some((b) => t >= b.startMin && t < b.endMin);
}

/** Converte blocos (timestamptz) para janelas em minutos relativas ao dia informado. */
export function blocksToWindows(rows: { starts_at: string; ends_at: string }[], day: Date): SlotWindow[] {
  const dayStartMs = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  return rows
    .map((r) => ({
      startMin: Math.floor((new Date(r.starts_at).getTime() - dayStartMs) / 60000),
      endMin: Math.ceil((new Date(r.ends_at).getTime() - dayStartMs) / 60000),
    }))
    .filter((b) => b.endMin > b.startMin);
}

/**
 * Gera os horários (HH:MM) de um dia a partir das janelas de trabalho.
 * - `windows`: janelas do barbeiro naquele weekday (1 ou 2 = manhã/tarde com intervalo).
 * - `stepMin`: espaçamento entre horários (default 30).
 * - `isToday`/`nowMin`: descarta horários já passados hoje.
 * - `blocked`: janelas bloqueadas (folgas/travas) daquele dia, em minutos.
 */
export function buildDaySlots({
  windows,
  stepMin = 30,
  isToday = false,
  nowMin = 0,
  blocked = [],
}: {
  windows: SlotWindow[];
  stepMin?: number;
  isToday?: boolean;
  nowMin?: number;
  blocked?: SlotWindow[];
}): string[] {
  const step = stepMin > 0 ? stepMin : 30;
  const seen = new Set<number>();
  for (const w of windows) {
    if (w.endMin <= w.startMin) continue;
    for (let t = w.startMin; t <= w.endMin; t += step) {
      if (isToday && t <= nowMin) continue;
      if (inBlocked(t, blocked)) continue;
      seen.add(t);
    }
  }
  return [...seen].sort((a, b) => a - b).map(minToHHMM);
}
