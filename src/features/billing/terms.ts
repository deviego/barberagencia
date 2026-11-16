import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultBillingTerms, normalizeSaasPlan } from "@/lib/entitlements";
import type { BillingTerms, PaymentRecord } from "@/lib/billing/saas-pricing";

/**
 * Condições vendidas da barbearia (tenant_billing_terms, schema-34). Só service-role:
 * quem chama já checou isMaster. Degrada para a tabela padrão se a migração não rodou.
 */
export async function loadBillingTerms(
  admin: SupabaseClient,
  tenantId: string,
  rawPlan: string | null
): Promise<{ terms: BillingTerms; stored: boolean; source: string | null; tableExists: boolean }> {
  const res = await admin
    .from("tenant_billing_terms")
    .select("promo_price_brl, promo_months, full_price_brl, source")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (res.error || !res.data) {
    return { terms: defaultBillingTerms(normalizeSaasPlan(rawPlan)), stored: false, source: null, tableExists: !res.error };
  }
  const r = res.data as Record<string, unknown>;
  return {
    terms: {
      promoPriceBrl: r.promo_price_brl == null ? null : Number(r.promo_price_brl),
      promoMonths: Number(r.promo_months ?? 0),
      fullPriceBrl: Number(r.full_price_brl),
    },
    stored: true,
    source: (r.source as string) ?? null,
    tableExists: true,
  };
}

/** Grava a tabela padrão do plano na barbearia (fechamento ou troca de plano). Não quebra o fluxo se falhar. */
export async function writeDefaultBillingTerms(admin: SupabaseClient, tenantId: string, rawPlan: string, userId: string | null) {
  const plan = normalizeSaasPlan(rawPlan);
  const d = defaultBillingTerms(plan);
  const { error } = await admin.from("tenant_billing_terms").upsert(
    {
      tenant_id: tenantId,
      plan,
      promo_price_brl: d.promoPriceBrl,
      promo_months: d.promoMonths,
      full_price_brl: d.fullPriceBrl,
      source: "TABLE",
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: "tenant_id" }
  );
  if (error) console.error("[billing] condições não gravadas (schema-34 aplicado?)", error.message);
}

/** Todas as linhas de pagamento da barbearia no formato do cálculo (colunas novas podem não existir). */
export async function loadPaymentRecords(admin: SupabaseClient, tenantId: string): Promise<{ records: PaymentRecord[]; competenciaColumns: boolean }> {
  const full = await admin
    .from("saas_payments")
    .select("amount_brl, paid_at, paid_until, competencia_from, competencia_to, expected_brl, partial")
    .eq("tenant_id", tenantId)
    .order("paid_at", { ascending: true });
  if (!full.error) {
    return {
      records: ((full.data ?? []) as Record<string, unknown>[]).map((r) => ({
        amountBrl: Number(r.amount_brl ?? 0),
        paidAt: r.paid_at as string,
        paidUntil: (r.paid_until as string) ?? null,
        competenciaFrom: r.competencia_from == null ? null : Number(r.competencia_from),
        competenciaTo: r.competencia_to == null ? null : Number(r.competencia_to),
        expectedBrl: r.expected_brl == null ? null : Number(r.expected_brl),
        partial: r.partial === true,
      })),
      competenciaColumns: true,
    };
  }
  const legacy = await admin
    .from("saas_payments")
    .select("amount_brl, paid_at, paid_until")
    .eq("tenant_id", tenantId)
    .order("paid_at", { ascending: true });
  return {
    records: ((legacy.data ?? []) as Record<string, unknown>[]).map((r) => ({
      amountBrl: Number(r.amount_brl ?? 0),
      paidAt: r.paid_at as string,
      paidUntil: (r.paid_until as string) ?? null,
      competenciaFrom: null,
      competenciaTo: null,
      expectedBrl: null,
      partial: false,
    })),
    competenciaColumns: false,
  };
}
