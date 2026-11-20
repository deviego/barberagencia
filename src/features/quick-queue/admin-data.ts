import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuickQueueLimitKind, QuickQueueLimitSummary } from "./types";

/*
 * Alerta ao dono (#99): contagem do dia de limites estourados da fila rápida. Leitura com a
 * sessão do painel: a RLS de quick_queue_limit_daily só devolve a barbearia do admin logado.
 * Sem telefone, aparelho ou cliente: só tipo e quantidade.
 */
export async function getQuickQueueLimitSummary(tenantId: string): Promise<QuickQueueLimitSummary | null> {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("quick_queue_limit_daily")
    .select("kind, hits")
    .eq("tenant_id", tenantId)
    .eq("day", day);
  if (error) return null;
  const byKind: QuickQueueLimitSummary["byKind"] = {};
  let total = 0;
  for (const r of (data ?? []) as { kind: QuickQueueLimitKind; hits: number }[]) {
    byKind[r.kind] = r.hits;
    total += r.hits;
  }
  return { total, byKind, tenantCapHit: (byKind.TENANT_ACTIVE ?? 0) > 0 };
}
