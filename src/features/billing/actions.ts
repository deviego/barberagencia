"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { isUuid } from "@/lib/auth/acting";
import { z } from "zod";
import { isDistributorPlan, normalizeSaasPlan } from "@/lib/entitlements";
import { suggestPayment } from "@/lib/billing/saas-pricing";
import { loadBillingTerms, loadPaymentRecords } from "./terms";

/** Estende uma data em N meses (mantém o dia; base = maior entre data atual e agora). */
function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

export type RegisterSaasPaymentInput = {
  tenantId: string;
  amountBrl: number;
  method: string;
  months: number;
  note?: string;
  /** 1ª parte de uma competência paga em duas vezes (ex.: metade no fechamento). */
  partial?: boolean;
};

/** MASTER registra um pagamento manual da mensalidade e renova a vigência (paid_until). */
export async function registerSaasPayment(input: RegisterSaasPaymentInput) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  if (!isUuid(input.tenantId)) return { ok: false as const, error: "Barbearia inválida." };
  const amount = Number(input.amountBrl);
  if (!(amount > 0)) return { ok: false as const, error: "Informe um valor válido." };
  const months = Math.max(1, Math.min(24, Math.floor(input.months || 1)));

  const admin = createSupabaseAdminClient();
  const { data: t } = await admin.from("tenants").select("saas_plan").eq("id", input.tenantId).maybeSingle();
  const rawPlan = (t?.saas_plan as string | undefined) ?? null;

  // Base da vigência: a maior entre o paid_until atual e hoje (não perde dias já pagos).
  const cRes = await admin.from("tenant_contracts").select("paid_until").eq("tenant_id", input.tenantId).maybeSingle();
  if (cRes.error) return { ok: false as const, error: "Cobrança não configurada — aplique a migração schema-23." };
  const current = cRes.data?.paid_until ? new Date(cRes.data.paid_until as string) : null;
  const base = current && current.getTime() > Date.now() ? current : new Date();
  const now = new Date();

  // Competência (S1): recalculada no servidor a partir das linhas gravadas — nunca vem do cliente.
  // Distribuidor fica como antes (sem competência). Sem schema-34, grava como antes.
  let extendMonths = months;
  let competencia: { from: number; to: number; expected: number; partial: boolean; label: string; breakdown: string | null } | null = null;
  if (!isDistributorPlan(rawPlan)) {
    const [tr, pr] = await Promise.all([
      loadBillingTerms(admin, input.tenantId, rawPlan),
      loadPaymentRecords(admin, input.tenantId),
    ]);
    if (tr.tableExists && pr.competenciaColumns) {
      const s = suggestPayment(tr.terms, pr.records, input.partial ? 1 : months, now.toISOString());
      if (s.kind === "REMAINING") {
        // Completa a competência aberta: mesma competência, a vigência já andou na 1ª parte.
        competencia = { from: s.competencia, to: s.competencia, expected: s.amountBrl, partial: true, label: s.label, breakdown: null };
        extendMonths = 0;
      } else if (input.partial) {
        // 1ª parte: libera o mês (vigência +1); o restante entra como "Falta R$ X".
        competencia = { from: s.competenciaFrom, to: s.competenciaFrom, expected: s.amountBrl, partial: true, label: s.label, breakdown: null };
        extendMonths = 1;
      } else {
        competencia = { from: s.competenciaFrom, to: s.competenciaTo, expected: s.amountBrl, partial: false, label: s.label, breakdown: s.breakdown };
      }
    }
  }

  const paidUntil = extendMonths > 0 ? addMonths(base, extendMonths) : current ?? base;
  const reference = competencia?.label ?? `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const userNote = input.note?.trim() || null;
  const note = competencia?.breakdown ? (userNote ? `${competencia.breakdown} · ${userNote}` : competencia.breakdown) : userNote;
  const row: Record<string, unknown> = {
    tenant_id: input.tenantId,
    plan: rawPlan,
    amount_brl: amount,
    method: input.method,
    paid_at: now.toISOString(),
    paid_until: paidUntil.toISOString(),
    reference,
    note,
    created_by: user.id,
  };
  if (competencia) {
    row.competencia_from = competencia.from;
    row.competencia_to = competencia.to;
    row.expected_brl = competencia.expected;
    row.partial = competencia.partial;
  }
  const { error: insErr } = await admin.from("saas_payments").insert(row);
  if (insErr) return { ok: false as const, error: `Falha ao registrar (aplique schema-23?): ${insErr.message}` };

  if (extendMonths > 0) {
    await admin.from("tenant_contracts").update({ paid_until: paidUntil.toISOString(), updated_at: now.toISOString() }).eq("tenant_id", input.tenantId);
  }
  await admin.from("tenants").update({ status: "ACTIVE" }).eq("id", input.tenantId);

  revalidatePath(`/master/barbearias/${input.tenantId}`);
  return { ok: true as const, paidUntil: paidUntil.toISOString() };
}

const termsSchema = z
  .object({
    tenantId: z.string().uuid(),
    promoPriceBrl: z.number().min(0).max(100000).nullable(),
    promoMonths: z.number().int().min(0).max(24),
    fullPriceBrl: z.number().positive().max(100000),
  })
  .refine((v) => (v.promoPriceBrl == null) === (v.promoMonths === 0), {
    message: "Informe o preço e o número de mensalidades da promoção (ou deixe os dois vazios).",
  });

/**
 * MASTER edita as condições vendidas da barbearia (S0). Vale da próxima competência em
 * diante: as já pagas estão gravadas em saas_payments e não mudam.
 */
export async function updateBillingTerms(input: z.input<typeof termsSchema>) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  const parsed = termsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: t } = await admin.from("tenants").select("saas_plan").eq("id", v.tenantId).maybeSingle();
  if (!t) return { ok: false as const, error: "Barbearia não encontrada." };
  if (isDistributorPlan(t.saas_plan as string)) return { ok: false as const, error: "Distribuidor não usa condições de promoção." };

  const { error } = await admin.from("tenant_billing_terms").upsert(
    {
      tenant_id: v.tenantId,
      plan: normalizeSaasPlan(t.saas_plan as string),
      promo_price_brl: v.promoPriceBrl,
      promo_months: v.promoMonths,
      full_price_brl: v.fullPriceBrl,
      source: "MANUAL",
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "tenant_id" }
  );
  if (error) return { ok: false as const, error: "Não foi possível salvar (aplique a migração schema-34)." };
  revalidatePath(`/master/barbearias/${v.tenantId}`);
  return { ok: true as const };
}

/** MASTER suspende ou reativa manualmente o acesso da barbearia. */
export async function setTenantStatus(tenantId: string, status: "ACTIVE" | "SUSPENDED") {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  if (!isUuid(tenantId)) return { ok: false as const, error: "Barbearia inválida." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("tenants").update({ status }).eq("id", tenantId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/master/barbearias/${tenantId}`);
  return { ok: true as const };
}
