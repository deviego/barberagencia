"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isUnitAdmin } from "@/lib/rbac";
import { loadQuickQueueTenantState } from "./data";
import { planAllowsQueue } from "./rules";
import { QUICK_QUEUE_ADMIN_MESSAGES as MSG, type SetQuickQueueEnabledResult } from "./types";

/*
 * Interruptor da fila rápida (#102).
 * Por que service role: a escrita em tenants e em audit_log precisa acontecer junto, e a
 * barbearia já foi resolvida pela sessão do painel (admin da unidade ou master atuando nela).
 * Nada vem do navegador além de true/false.
 */

const Input = z.boolean();

export async function setQuickQueueEnabled(enabled: boolean): Promise<SetQuickQueueEnabledResult> {
  const parsed = Input.safeParse(enabled);
  if (!parsed.success) return { ok: false, code: "GENERIC", error: MSG.failed };

  const user = await getSessionUser();
  if (!user?.tenantId || !user.role || !isUnitAdmin(user.role)) {
    return { ok: false, code: "FORBIDDEN", error: MSG.forbidden };
  }
  const tenantId = user.tenantId;
  const admin = createSupabaseAdminClient();

  const { data: t, error: tErr } = await admin
    .from("tenants")
    .select("subdomain, quick_queue_enabled")
    .eq("id", tenantId)
    .maybeSingle();
  if (tErr || !t?.subdomain) return { ok: false, code: "GENERIC", error: MSG.failed };

  if (parsed.data) {
    // Ligar: mesma leitura e mesma regra de plano da fila rápida (falha fechado).
    let state;
    try {
      state = await loadQuickQueueTenantState(t.subdomain as string);
    } catch {
      return { ok: false, code: "GENERIC", error: MSG.failed };
    }
    if (!state || state.id !== tenantId || state.kind !== "BARBERSHOP" || state.readFailed) {
      return { ok: false, code: "GENERIC", error: MSG.failed };
    }
    if (!planAllowsQueue(state, new Date())) return { ok: false, code: "PLAN", error: MSG.plan };
    if (!state.queueEnabled) return { ok: false, code: "QUEUE_OFF", error: MSG.queueOff };
  }

  const previous = t.quick_queue_enabled === true;
  if (previous !== parsed.data) {
    const { error: uErr } = await admin.from("tenants").update({ quick_queue_enabled: parsed.data }).eq("id", tenantId);
    if (uErr) return { ok: false, code: "GENERIC", error: MSG.failed };

    // Registro de quem mudou e quando. Sem registro, a mudança é desfeita.
    const { error: aErr } = await admin.from("audit_log").insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: parsed.data ? "quick_queue.enabled" : "quick_queue.disabled",
      target: "tenants.quick_queue_enabled",
      metadata: { enabled: parsed.data, previous },
    });
    if (aErr) {
      await admin.from("tenants").update({ quick_queue_enabled: previous }).eq("id", tenantId);
      console.error(`[quick-queue] registro do interruptor indisponível (${aErr.code ?? "sem código"})`);
      return { ok: false, code: "GENERIC", error: MSG.failed };
    }
  }

  revalidatePath("/admin/config");
  revalidatePath("/admin/fila");
  return { ok: true, enabled: parsed.data };
}
