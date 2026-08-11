"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";

/** Cliente entra na fila (ou atualiza serviço/barbeiro da senha de hoje). */
export async function joinQueue(tenantId: string, serviceId?: string | null, barberId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("join_queue", {
    p_tenant_id: tenantId,
    p_service_id: serviceId ?? null,
    p_barber_id: barberId ?? null,
  });
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

/** Admin: inicia o atendimento → cria a comanda (appointment + item) e marca IN_SERVICE. */
export async function startQueue(id: string, opts?: { barberId?: string | null; serviceId?: string | null }) {
  const supabase = await createSupabaseServerClient();
  const { data: entry } = await supabase
    .from("queue_entries")
    .select("tenant_id, client_id, service_id, barber_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!entry) return { ok: false as const, error: "Senha não encontrada." };

  const serviceId = opts?.serviceId ?? (entry.service_id as string | null);
  const barberId = opts?.barberId ?? (entry.barber_id as string | null);
  const now = new Date().toISOString();

  // Cria a comanda (segue o fluxo de pedidos atual): appointment CONFIRMED + item do serviço.
  const { data: appt, error: aerr } = await supabase
    .from("appointments")
    .insert({
      tenant_id: entry.tenant_id,
      client_id: entry.client_id,
      barber_id: barberId,
      service_id: serviceId,
      start_at: now,
      status: "CONFIRMED",
      service_started_at: now,
    })
    .select("id")
    .single();
  if (aerr) return { ok: false as const, error: aerr.message };

  if (serviceId) {
    const { data: svc } = await supabase
      .from("services")
      .select("name, price_brl, duration_min")
      .eq("id", serviceId)
      .maybeSingle();
    await supabase.from("appointment_items").insert({
      appointment_id: appt.id,
      tenant_id: entry.tenant_id,
      kind: "service",
      ref_id: serviceId,
      name: (svc?.name as string) ?? "Serviço",
      price_brl: (svc?.price_brl as number) ?? 0,
      qty: 1,
      duration_min: (svc?.duration_min as number) ?? 0,
      covered_by_plan: false,
    });
  }

  const { error: uerr } = await supabase
    .from("queue_entries")
    .update({ status: "IN_SERVICE", appointment_id: appt.id, barber_id: barberId, service_id: serviceId, started_at: now, called_at: now })
    .eq("id", id);
  if (uerr) return { ok: false as const, error: uerr.message };

  revalidatePath("/admin/fila");
  revalidatePath("/admin/pedidos");
  return { ok: true as const, appointmentId: appt.id as string };
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
