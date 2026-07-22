"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyClient } from "./data";

const schema = z.object({
  barberId: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
  comboPlanId: z.string().uuid().nullable().optional(),
  startAt: z.string().min(1),
  usePlan: z.boolean(),
});

export type RequestAppointmentInput = z.infer<typeof schema>;

/** Cria um agendamento como SOLICITAÇÃO (timer 10 min). Consome saldo se for plano. */
export async function requestAppointment(input: RequestAppointmentInput) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };

  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return { ok: false as const, error: "Cliente não encontrado" };

  const requestExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      tenant_id: client.tenant_id,
      client_id: client.id,
      barber_id: parsed.data.barberId ?? null,
      service_id: parsed.data.serviceId ?? null,
      combo_plan_id: parsed.data.comboPlanId ?? null,
      start_at: parsed.data.startAt,
      status: "REQUESTED",
      request_expires_at: requestExpiresAt,
      consumed_from_plan: parsed.data.usePlan,
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  if (parsed.data.usePlan) {
    const { error: rpcErr } = await supabase.rpc("consume_cut", { p_client_id: client.id });
    if (rpcErr) {
      await supabase.from("appointments").delete().eq("id", data.id);
      return { ok: false as const, error: rpcErr.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/agendamentos");
  return { ok: true as const, id: data.id as string };
}

/** Assina/ativa um combo para o cliente logado (1ª assinatura — imediata; pagamento no local). */
export async function subscribeCombo(comboPlanId: string) {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return { ok: false as const, error: "Cliente não encontrado" };
  const { error } = await supabase.rpc("assign_combo", {
    p_client_id: client.id,
    p_combo_plan_id: comboPlanId,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  revalidatePath("/meu-plano");
  return { ok: true as const };
}

/** Já existe um pedido de plano pendente para este cliente? */
async function hasPendingPlanRequest(clientId: string) {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("plan_requests")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "PENDING");
  return (count ?? 0) > 0;
}

/** Solicita TROCA de plano — vira pedido pendente (admin aprova). Plano atual segue ativo. */
export async function requestPlanChange(comboPlanId: string) {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return { ok: false as const, error: "Cliente não encontrado" };
  if (await hasPendingPlanRequest(client.id))
    return { ok: false as const, error: "Você já tem um pedido de plano em análise." };
  const { error } = await supabase.from("plan_requests").insert({
    tenant_id: client.tenant_id,
    client_id: client.id,
    type: "CHANGE",
    combo_plan_id: comboPlanId,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/meu-plano");
  return { ok: true as const };
}

/** Solicita CANCELAMENTO do plano — vira pedido pendente (admin confirma). */
export async function requestPlanCancel() {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return { ok: false as const, error: "Cliente não encontrado" };
  if (await hasPendingPlanRequest(client.id))
    return { ok: false as const, error: "Você já tem um pedido de plano em análise." };
  const { error } = await supabase.from("plan_requests").insert({
    tenant_id: client.tenant_id,
    client_id: client.id,
    type: "CANCEL",
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/meu-plano");
  return { ok: true as const };
}

/** Atualiza dados do perfil (profiles + clients), incluindo a foto. */
export async function updateProfile(values: { fullName: string; phone: string; avatarUrl?: string | null }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sessão expirada" };
  const profilePatch: Record<string, unknown> = { full_name: values.fullName, phone: values.phone };
  const clientPatch: Record<string, unknown> = { name: values.fullName, phone: values.phone };
  if (values.avatarUrl !== undefined) {
    profilePatch.avatar_url = values.avatarUrl;
    clientPatch.avatar_url = values.avatarUrl;
  }
  await supabase.from("profiles").update(profilePatch).eq("id", user.id);
  await supabase.from("clients").update(clientPatch).eq("user_id", user.id);
  revalidatePath("/perfil");
  revalidatePath("/");
  return { ok: true as const };
}

/** Reserva um produto para retirada. */
export async function reserveProduct(productId: string, qty = 1) {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return { ok: false as const, error: "Cliente não encontrado" };
  const { error } = await supabase.from("product_reservations").insert({
    tenant_id: client.tenant_id,
    client_id: client.id,
    product_id: productId,
    qty,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/** Cancela um agendamento do cliente; devolve o corte ao saldo se era do plano. */
export async function cancelAppointment(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("client_id, consumed_from_plan")
    .eq("id", id)
    .maybeSingle();
  if (!appt) return { ok: false as const, error: "Agendamento não encontrado" };

  const { error } = await supabase.from("appointments").update({ status: "CANCELLED" }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  if (appt.consumed_from_plan) {
    await supabase.rpc("return_cut", { p_client_id: appt.client_id });
  }
  revalidatePath("/");
  revalidatePath("/agendamentos");
  return { ok: true as const };
}

/** Reagenda a MESMA reserva para um novo horário (sem duplicar). Volta a "aguardando". */
export async function rescheduleAppointment(id: string, startAtISO: string) {
  if (!startAtISO) return { ok: false as const, error: "Horário inválido" };
  const supabase = await createSupabaseServerClient();
  const requestExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("appointments")
    .update({
      start_at: startAtISO,
      status: "REQUESTED",
      request_expires_at: requestExpiresAt,
      rescheduled_from: id,
      no_show: false,
    })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  revalidatePath("/agendamentos");
  return { ok: true as const };
}
