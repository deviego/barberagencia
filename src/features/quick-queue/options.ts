import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/utils";
import type { QuickQueueBarberOption, QuickQueueOptions } from "./types";

/*
 * Leituras da #97. Por que service role: visitante sem sessão; a barbearia já foi resolvida pelo
 * guard a partir do endereço e o aparelho pelo resumo da credencial. Nada vem do navegador.
 */

function adminOrNull() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

/*
 * #97 — opções da tela de serviço. Mesmos filtros da fila de hoje (getQueueServices /
 * getQueueBarbers): serviço ativo da barbearia; barbeiro ativo, da barbearia e que atende fila.
 * null = leitura indisponível (a tela mostra erro genérico, nunca uma lista vazia por engano).
 */
export async function loadQuickQueueOptions(tenantId: string): Promise<QuickQueueOptions | null> {
  const admin = adminOrNull();
  if (!admin) return null;
  const [svc, set, bar] = await Promise.all([
    admin.from("services").select("id, name, price_brl").eq("tenant_id", tenantId).eq("active", true).order("name"),
    admin.from("tenant_settings").select("queue_pick_barber").eq("tenant_id", tenantId).maybeSingle(),
    admin
      .from("barbers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .eq("accepts_queue", true)
      .order("name"),
  ]);
  if (svc.error || set.error || bar.error) return null;
  const pickBarber = set.data?.queue_pick_barber === true;
  return {
    services: ((svc.data ?? []) as { id: string; name: string; price_brl: number | string }[]).map((s) => {
      const priceCents = Math.round(Number(s.price_brl) * 100);
      return { id: s.id, name: s.name, priceCents, priceLabel: formatBRL(priceCents / 100) };
    }),
    pickBarber,
    barbers: pickBarber ? ((bar.data ?? []) as QuickQueueBarberOption[]) : [],
  };
}

/** O aparelho tem telefone identificado nesta barbearia? (credencial válida e ligada a um cliente) */
export async function deviceHasClient(tenantId: string, deviceHash: string): Promise<boolean | null> {
  const admin = adminOrNull();
  if (!admin) return null;
  const { data, error } = await admin
    .from("quick_queue_devices")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("token_hash", deviceHash)
    .gt("expires_at", new Date().toISOString())
    .not("client_id", "is", null)
    .maybeSingle();
  if (error) return null;
  return Boolean(data);
}
