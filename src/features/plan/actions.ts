"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { sendEmail } from "@/server/notifications/resend";
import { BARBERAGENCIA_EMAIL } from "@/lib/contact";
import { PLAN_ORDER, planLabel, normalizeSaasPlan } from "@/lib/entitlements";

/** O admin solicita upgrade de plano — gera a solicitação e avisa o master. */
export async function requestUpgrade(input?: { requestedPlan?: string; reason?: string }) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };

  const supabase = await createSupabaseServerClient();
  const { data: t } = await supabase.from("tenants").select("name, saas_plan").maybeSingle();
  const current = normalizeSaasPlan((t?.saas_plan as string) ?? null);
  // Se não informado, sugere o próximo plano acima.
  const idx = PLAN_ORDER.indexOf(current);
  const suggested = PLAN_ORDER[Math.min(idx + 1, PLAN_ORDER.length - 1)];
  const requested = normalizeSaasPlan(input?.requestedPlan ?? suggested);

  const { error } = await supabase.from("plan_upgrade_requests").insert({
    tenant_id: user.tenantId,
    current_plan: current,
    requested_plan: requested,
    reason: input?.reason?.trim() || null,
    requested_by: user.id,
    status: "PENDING",
  });
  if (error) return { ok: false as const, error: error.message };

  // Avisa o master (best-effort).
  try {
    await sendEmail({
      to: BARBERAGENCIA_EMAIL,
      subject: `Solicitação de upgrade — ${t?.name ?? "Barbearia"}`,
      html: `<p>A barbearia <strong>${t?.name ?? user.tenantId}</strong> solicitou upgrade.</p>
             <p>Plano atual: <strong>${planLabel(current)}</strong> → desejado: <strong>${planLabel(requested)}</strong></p>
             ${input?.reason ? `<p>Motivo: ${input.reason}</p>` : ""}`,
    });
  } catch {
    /* não bloqueia */
  }

  revalidatePath("/admin/config");
  return { ok: true as const, requested };
}

/** MASTER troca o plano de uma barbearia (service-role). */
export async function setTenantPlan(tenantId: string, plan: string) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  const p = normalizeSaasPlan(plan);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("tenants").update({ saas_plan: p }).eq("id", tenantId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/master/barbearias/${tenantId}`);
  return { ok: true as const };
}

/** MASTER resolve uma solicitação de upgrade (aprova trocando o plano, ou rejeita). */
export async function resolveUpgradeRequest(id: string, approve: boolean) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  const admin = createSupabaseAdminClient();

  const { data: req } = await admin
    .from("plan_upgrade_requests")
    .select("tenant_id, requested_plan, status")
    .eq("id", id)
    .maybeSingle();
  if (!req) return { ok: false as const, error: "Solicitação não encontrada." };
  if (req.status !== "PENDING") return { ok: false as const, error: "Solicitação já resolvida." };

  if (approve) {
    const plan = normalizeSaasPlan(req.requested_plan as string);
    await admin.from("tenants").update({ saas_plan: plan }).eq("id", req.tenant_id as string);
  }
  const { error } = await admin
    .from("plan_upgrade_requests")
    .update({ status: approve ? "DONE" : "REJECTED", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/master/barbearias");
  return { ok: true as const };
}

