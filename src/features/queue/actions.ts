"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";

/** Cliente entra na fila (ou atualiza serviço/barbeiro da senha de hoje). */
export async function joinQueue(tenantId: string, serviceId?: string | null, barberId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const call = () =>
    supabase.rpc("join_queue", {
      p_tenant_id: tenantId,
      p_service_id: serviceId ?? null,
      p_barber_id: barberId ?? null,
    });
  let { data, error } = await call();
  // 23505: outro caminho (totem, fila rápida ou um segundo toque) gravou no mesmo instante. A
  // regra de 1 senha ativa por cliente (schema-54) ou a numeração seguraram; a segunda chamada
  // devolve a senha que ficou valendo.
  if (error?.code === "23505") ({ data, error } = await call());
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/client/fila");
  revalidatePath("/client");
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, ticket: row?.ticket_number as number, id: row?.id as string };
}

/** Cliente sai da fila. */
export async function leaveQueue(entryId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("leave_queue", { p_entry_id: entryId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/client/fila");
  revalidatePath("/client");
  return { ok: true as const };
}

/** Admin: marca a senha como chamada (segue aguardando). */
export async function callQueue(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("queue_entries")
    .update({ called_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/fila");
  return { ok: true as const };
}

/** Erros estáveis de start_queue_entry (schema-55) → texto para o painel. Nunca repassa o banco. */
const START_ERRORS: [RegExp, string][] = [
  [/QUEUE_FORBIDDEN/, "Sem permissão para atender esta senha."],
  [/QUEUE_ENTRY_NOT_FOUND/, "Senha não encontrada."],
  [/QUEUE_ENTRY_NOT_WAITING/, "Esta senha não está mais aguardando."],
  [/QUEUE_SERVICE_NOT_IN_TENANT/, "Serviço inválido."],
  [/QUEUE_BARBER_NOT_IN_TENANT/, "Barbeiro inválido."],
  [/QUEUE_PLAN_NONE/, "O cliente não tem plano ativo."],
  [/QUEUE_PLAN_FIXED/, "Plano fixo não usa a fila. Cobre avulso ou use \"Remover um corte\"."],
  [/Sem saldo de cortes/, "O plano não tem corte disponível."],
];

/**
 * Admin: inicia o atendimento → comanda + IN_SERVICE numa transação só (start_queue_entry,
 * schema-55). usePlan = "Usar plano" confirmado na cadeira pela equipe: o corte sai do plano
 * por saldo (mesmo caminho da agenda) e fica registrado quem confirmou e quando. Sem usePlan,
 * a comanda é avulsa. Nenhuma senha desconta plano sozinha (#100).
 */
export async function startQueue(
  id: string,
  opts?: { barberId?: string | null; serviceId?: string | null; usePlan?: boolean }
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("start_queue_entry", {
    p_entry_id: id,
    p_use_plan: opts?.usePlan === true,
    p_barber_id: opts?.barberId ?? null,
    p_service_id: opts?.serviceId ?? null,
  });
  if (error) {
    const msg = START_ERRORS.find(([re]) => re.test(error.message))?.[1] ?? "Não foi possível iniciar. Tente de novo.";
    return { ok: false as const, error: msg };
  }

  revalidatePath("/admin/fila");
  revalidatePath("/admin/pedidos");
  return { ok: true as const, appointmentId: data as string };
}

/** Admin: conclui o atendimento da fila. */
export async function finishQueue(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "DONE", ended_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/fila");
  return { ok: true as const };
}

/** Admin: remove da fila (não veio / desistiu). */
export async function removeQueue(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "LEFT", ended_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/fila");
  return { ok: true as const };
}

/** Admin: liga/desliga a opção de o cliente escolher o barbeiro na fila. */
export async function setQueuePickBarber(enabled: boolean) {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
  const { error } = await supabase
    .from("tenant_settings")
    .upsert({ tenant_id: user.tenantId, queue_pick_barber: enabled }, { onConflict: "tenant_id" });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/config");
  return { ok: true as const };
}

/** Master: habilita/desabilita a Fila de uma barbearia. */
export async function setQueueEnabled(tenantId: string, enabled: boolean) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("tenants").update({ queue_enabled: enabled }).eq("id", tenantId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/master/barbearias/${tenantId}`);
  return { ok: true as const };
}
