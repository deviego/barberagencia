"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { isUuid } from "@/lib/auth/acting";

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

  // Base da vigência: a maior entre o paid_until atual e hoje (não perde dias já pagos).
  const cRes = await admin.from("tenant_contracts").select("paid_until").eq("tenant_id", input.tenantId).maybeSingle();
  if (cRes.error) return { ok: false as const, error: "Cobrança não configurada — aplique a migração schema-23." };
  const current = cRes.data?.paid_until ? new Date(cRes.data.paid_until as string) : null;
  const base = current && current.getTime() > Date.now() ? current : new Date();
  const paidUntil = addMonths(base, months);

  const now = new Date();
  const reference = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const { error: insErr } = await admin.from("saas_payments").insert({
    tenant_id: input.tenantId,
    plan: t?.saas_plan ?? null,
    amount_brl: amount,
    method: input.method,
    paid_at: now.toISOString(),
    paid_until: paidUntil.toISOString(),
    reference,
    note: input.note?.trim() || null,
    created_by: user.id,
  });
  if (insErr) return { ok: false as const, error: `Falha ao registrar (aplique schema-23?): ${insErr.message}` };

  await admin.from("tenant_contracts").update({ paid_until: paidUntil.toISOString(), updated_at: now.toISOString() }).eq("tenant_id", input.tenantId);
  await admin.from("tenants").update({ status: "ACTIVE" }).eq("id", input.tenantId);

  revalidatePath(`/master/barbearias/${input.tenantId}`);
  return { ok: true as const, paidUntil: paidUntil.toISOString() };
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
