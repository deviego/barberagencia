"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyPlanRequested, notifyAppointmentRequested, notifyAppointmentCancelled, notifyServiceAdded } from "@/server/notifications/notify";
import { checkLimit } from "@/lib/plan/effective";
import { getMyClient } from "./data";

const itemSchema = z.object({
  kind: z.enum(["service", "product"]),
  refId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  priceBRL: z.number().nonnegative(),
  qty: z.number().int().positive(),
  durationMin: z.number().int().nonnegative().optional(),
});

const schema = z.object({
  barberId: z.string().uuid().nullable().optional(),
  comboPlanId: z.string().uuid().nullable().optional(),
  startAt: z.string().min(1),
  usePlan: z.boolean(),
  paymentMethod: z.enum(["PIX", "CARD_CREDIT", "CARD_DEBIT", "CASH"]).nullable().optional(),
  childId: z.string().uuid().nullable().optional(),
  observations: z.string().max(500).nullable().optional(),
  items: z.array(itemSchema).min(1),
});

export type RequestAppointmentInput = z.infer<typeof schema>;

/** Cria uma comanda como SOLICITAÇÃO (timer 10 min). Consome 1 corte do plano se usePlan. */
export async function requestAppointment(input: RequestAppointmentInput) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const { barberId, comboPlanId, startAt, usePlan, paymentMethod, childId, observations, items } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return { ok: false as const, error: "Cliente não encontrado" };

  const quota = await checkLimit("appointments.monthly");
  if (!quota.allowed)
    return { ok: false as const, error: "A agenda da barbearia atingiu o limite do mês. Tente novamente mais tarde." };

  // Bloqueio/folga: recusa horário travado pela barbearia (barbeiro ou geral).
  if (barberId) {
    const from = new Date(startAt).toISOString();
    const to = new Date(new Date(startAt).getTime() + 1000).toISOString();
    const { data: blocks } = await supabase.rpc("blocked_ranges", { p_barber_id: barberId, p_from: from, p_to: to });
    if (Array.isArray(blocks) && blocks.length > 0)
      return { ok: false as const, error: "Esse horário está bloqueado na agenda." };
  }

  const firstServiceIdx = items.findIndex((i) => i.kind === "service");
  const primaryServiceRef = firstServiceIdx >= 0 ? items[firstServiceIdx].refId ?? null : null;
  const requestExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      tenant_id: client.tenant_id,
      client_id: client.id,
      barber_id: barberId ?? null,
      service_id: primaryServiceRef,
      combo_plan_id: usePlan ? comboPlanId ?? null : null,
      start_at: startAt,
      status: "REQUESTED",
      request_expires_at: requestExpiresAt,
      consumed_from_plan: usePlan,
      payment_method: paymentMethod ?? null,
      child_id: childId ?? null,
      observations: observations?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  // Linhas da comanda; o 1º serviço fica coberto pelo plano quando usePlan.
  const rows = items.map((i, idx) => ({
    appointment_id: data.id,
    tenant_id: client.tenant_id,
    kind: i.kind,
    ref_id: i.refId ?? null,
    name: i.name,
    price_brl: i.priceBRL,
    qty: i.qty,
    duration_min: i.durationMin ?? 0,
    covered_by_plan: usePlan && idx === firstServiceIdx,
  }));
  const { error: itemsErr } = await supabase.from("appointment_items").insert(rows);
  if (itemsErr) {
    await supabase.from("appointments").delete().eq("id", data.id);
    return { ok: false as const, error: itemsErr.message };
  }

  if (usePlan) {
    const { error: rpcErr } = await supabase.rpc("consume_cut", { p_client_id: client.id });
    if (rpcErr) {
      await supabase.from("appointments").delete().eq("id", data.id);
      return { ok: false as const, error: rpcErr.message };
    }
  }

  try {
    await notifyAppointmentRequested(data.id as string);
  } catch {
    /* notificação não deve quebrar o fluxo */
  }

  revalidatePath("/client");
  revalidatePath("/client/agendamentos");
  return { ok: true as const, id: data.id as string };
}

/** Solicita a assinatura de um combo (aguarda aprovação do admin). Notifica o cliente. */
export async function subscribeCombo(comboPlanId: string) {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return { ok: false as const, error: "Cliente não encontrado" };
  if (await hasPendingPlanRequest(client.id))
    return { ok: false as const, error: "Você já tem um pedido de plano em análise." };
  const { error } = await supabase.from("plan_requests").insert({
    tenant_id: client.tenant_id,
    client_id: client.id,
    type: "SUBSCRIBE",
    combo_plan_id: comboPlanId,
  });
  if (error) return { ok: false as const, error: error.message };
  try {
    await notifyPlanRequested(client.id, comboPlanId);
  } catch {
    /* notificação não deve quebrar o fluxo */
  }
  revalidatePath("/client");
  revalidatePath("/client/meu-plano");
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
  revalidatePath("/client/meu-plano");
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
  revalidatePath("/client/meu-plano");
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
  revalidatePath("/client/perfil");
  revalidatePath("/client");
  return { ok: true as const };
}

const EDITAVEL = ["REQUESTED", "CONFIRMED", "ALT_OFFERED"];

/** Cliente adiciona um item (serviço/produto) à própria comanda (agendamento futuro, não iniciado). */
export async function addComandaItemClient(
  appointmentId: string,
  item: { kind: "service" | "product"; refId: string | null; name: string; priceBRL: number; qty: number; durationMin?: number }
) {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return { ok: false as const, error: "Cliente não encontrado" };
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, status, service_started_at, client_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt || appt.client_id !== client.id) return { ok: false as const, error: "Pedido não encontrado" };
  if (appt.service_started_at || !EDITAVEL.includes(appt.status as string))
    return { ok: false as const, error: "Este pedido não pode mais ser alterado." };

  const { error } = await supabase.from("appointment_items").insert({
    appointment_id: appointmentId,
    tenant_id: client.tenant_id,
    kind: item.kind,
    ref_id: item.refId,
    name: item.name,
    price_brl: item.priceBRL,
    qty: item.qty,
    duration_min: item.durationMin ?? 0,
    covered_by_plan: false,
    added_later: true,
  });
  if (error) return { ok: false as const, error: error.message };
  try {
    await notifyServiceAdded(appointmentId, {
      kind: item.kind,
      name: item.name,
      qty: item.qty,
      priceBRL: item.priceBRL,
    });
  } catch {
    /* notificação não deve quebrar o fluxo */
  }
  revalidatePath("/client/pedidos");
  revalidatePath("/client/agendamentos");
  revalidatePath("/client");
  return { ok: true as const };
}

/** Cliente remove um item que adicionou (RLS bloqueia o item coberto pelo plano / iniciado). */
export async function removeComandaItemClient(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("appointment_items").delete().eq("id", itemId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/client/pedidos");
  revalidatePath("/client/agendamentos");
  return { ok: true as const };
}

/** Cadastra uma criança (filho) para o cliente logado. */
export async function addChild(input: { name: string; age: number | null; photoUrl: string | null }) {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return { ok: false as const, error: "Cliente não encontrado" };
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Informe o nome da criança." };
  const { data, error } = await supabase
    .from("children")
    .insert({
      tenant_id: client.tenant_id,
      client_id: client.id,
      name,
      age: input.age ?? null,
      photo_url: input.photoUrl ?? null,
    })
    .select("id, name, age, photo_url")
    .single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/client/perfil");
  revalidatePath("/client/agendar");
  return { ok: true as const, child: data };
}

/** Remove uma criança cadastrada. */
export async function removeChild(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("children").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/client/perfil");
  revalidatePath("/client/agendar");
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
  try {
    await notifyAppointmentCancelled(id);
  } catch {
    /* notificação não deve quebrar o fluxo */
  }
  revalidatePath("/client");
  revalidatePath("/client/agendamentos");
  return { ok: true as const };
}

/** Reagenda a MESMA reserva para um novo horário (sem duplicar). Volta a "aguardando". */
export async function rescheduleAppointment(id: string, startAtISO: string) {
  if (!startAtISO) return { ok: false as const, error: "Horário inválido" };
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase.from("appointments").select("status, barber_id").eq("id", id).maybeSingle();
  if (!appt) return { ok: false as const, error: "Agendamento não encontrado" };
  if (appt.status === "CONFIRMED")
    return { ok: false as const, error: "Agendamento confirmado não pode ser reagendado, apenas cancelado." };
  if (appt.barber_id) {
    const from = new Date(startAtISO).toISOString();
    const to = new Date(new Date(startAtISO).getTime() + 1000).toISOString();
    const { data: blocks } = await supabase.rpc("blocked_ranges", { p_barber_id: appt.barber_id as string, p_from: from, p_to: to });
    if (Array.isArray(blocks) && blocks.length > 0)
      return { ok: false as const, error: "Esse horário está bloqueado na agenda." };
  }
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
  revalidatePath("/client");
  revalidatePath("/client/agendamentos");
  return { ok: true as const };
}
