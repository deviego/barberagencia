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

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * A chave do totem foi renovada depois do início da adoção da fila rápida? Sem início registrado,
 * registra agora (e a resposta é "não": a renovação tem de vir depois). "error" = leitura falhou.
 */
async function keyRotatedSinceAdoption(admin: Admin, tenantId: string): Promise<boolean | "error"> {
  const [{ data: st, error: sErr }, { data: t, error: tErr }] = await Promise.all([
    admin.from("tenant_settings").select("quick_queue_adoption_started_at").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("tenants").select("totem_key_rotated_at").eq("id", tenantId).maybeSingle(),
  ]);
  if (sErr || tErr) return "error";

  const started = (st?.quick_queue_adoption_started_at as string | null | undefined) ?? null;
  if (!started) {
    const { error } = await admin
      .from("tenant_settings")
      .upsert({ tenant_id: tenantId, quick_queue_adoption_started_at: new Date().toISOString() }, { onConflict: "tenant_id" });
    return error ? "error" : false;
  }
  const rotated = (t?.totem_key_rotated_at as string | null | undefined) ?? null;
  return !!rotated && new Date(rotated).getTime() > new Date(started).getTime();
}

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

    // #103 (regra no servidor, todas as barbearias): ligar só com a chave do totem renovada
    // DEPOIS do início da adoção. O primeiro pedido de ligar marca o início da adoção.
    const rotation = await keyRotatedSinceAdoption(admin, tenantId);
    if (rotation === "error") return { ok: false, code: "GENERIC", error: MSG.failed };
    if (!rotation) return { ok: false, code: "ROTATE_FIRST", error: MSG.rotateFirst };
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
      console.error(`[quick-queue] registro do interruptor indisponível (${aErr.code ?? "sem código"})`);
      const { error: rErr } = await admin.from("tenants").update({ quick_queue_enabled: previous }).eq("id", tenantId);
      // #148: se nem a reversão funcionou, a chave ficou mudada sem registro: precisa aparecer no log.
      if (rErr) {
        console.error(
          `[quick-queue] reversão do interruptor falhou; estado ficou ${parsed.data ? "ligado" : "desligado"} sem registro (${rErr.code ?? "sem código"}) tenant=${tenantId}`
        );
      }
      return { ok: false, code: "GENERIC", error: MSG.failed };
    }
  }

  revalidatePath("/admin/config");
  revalidatePath("/admin/fila");
  return { ok: true, enabled: parsed.data };
}
