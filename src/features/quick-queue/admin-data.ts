import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuickQueueAdminState, QuickQueueLimitKind, QuickQueueLimitSummary } from "./types";

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

/**
 * Estado do interruptor para o painel (#102/#103), lido com a sessão do admin (RLS de tenants e
 * tenant_settings). Falha de leitura = desligada e sem lembrete (falha fechado).
 */
export async function getQuickQueueAdminState(tenantId: string): Promise<QuickQueueAdminState> {
  const supabase = await createSupabaseServerClient();
  const [{ data: t, error: tErr }, { data: st, error: sErr }] = await Promise.all([
    supabase.from("tenants").select("quick_queue_enabled, totem_key_rotated_at").eq("id", tenantId).maybeSingle(),
    supabase.from("tenant_settings").select("quick_queue_adoption_started_at").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (tErr || sErr || !t) return { enabled: false, needsKeyRotation: false };
  const started = (st?.quick_queue_adoption_started_at as string | null | undefined) ?? null;
  const rotated = (t.totem_key_rotated_at as string | null | undefined) ?? null;
  return {
    enabled: t.quick_queue_enabled === true,
    needsKeyRotation: !!started && !(rotated && new Date(rotated).getTime() > new Date(started).getTime()),
  };
}
