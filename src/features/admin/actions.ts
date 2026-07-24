"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getClientDetail } from "./data";
import { notifyAppointmentConfirmed } from "@/server/notifications/notify";

async function setStatus(
  id: string,
  status: "CONFIRMED" | "ALT_OFFERED" | "EXPIRED" | "CANCELLED" | "DONE"
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  revalidatePath("/admin/solicitacoes");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  return { ok: !error, error: error?.message };
}

/** Aceitar solicitação → CONFIRMED + avisa o cliente por e-mail (se configurado). */
export async function acceptAppointment(id: string) {
  const res = await setStatus(id, "CONFIRMED");
  if (res.ok) {
    try {
      await notifyAppointmentConfirmed(id);
    } catch {
      /* não bloqueia a confirmação se a notificação falhar */
    }
  }
  return res;
}

/** Liberar horário (expirado/recusado). */
export async function expireAppointment(id: string) {
  return setStatus(id, "EXPIRED");
}

/** Marcar presença (atendido). */
export async function markDone(id: string) {
  return setStatus(id, "DONE");
}

/** Marcar falta (no-show). */
export async function markNoShow(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("appointments")
    .update({ no_show: true, status: "EXPIRED" })
    .eq("id", id);
  revalidatePath("/admin/agenda");
  return { ok: !error, error: error?.message };
}

export interface SaleItemInput {
  kind: "service" | "product";
  refId: string;
  name: string;
  priceBRL: number;
  qty: number;
}

/** POS: registra venda (payment + sale + itens + lançamento financeiro). */
export async function createSale(input: { clientId: string | null; method: string; items: SaleItemInput[] }) {
  if (!input.items.length) return { ok: false as const, error: "Nenhum item" };
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
  const total = input.items.reduce((s, i) => s + i.priceBRL * i.qty, 0);

  const { data: payment, error: perr } = await supabase
    .from("payments")
    .insert({ tenant_id: user.tenantId, client_id: input.clientId, method: input.method, amount_brl: total, status: "PAID" })
    .select("id")
    .single();
  if (perr) return { ok: false as const, error: perr.message };

  const { data: sale, error: serr } = await supabase
    .from("sales")
    .insert({ tenant_id: user.tenantId, client_id: input.clientId, total_brl: total, payment_id: payment.id })
    .select("id")
    .single();
  if (serr) return { ok: false as const, error: serr.message };

  await supabase.from("sale_items").insert(
    input.items.map((i) => ({ sale_id: sale.id, kind: i.kind, ref_id: i.refId, name: i.name, price_brl: i.priceBRL, qty: i.qty }))
  );
  await supabase.from("financial_entries").insert({
    tenant_id: user.tenantId,
    type: "REVENUE",
    amount_brl: total,
    method: input.method,
    ref_client: input.clientId,
    ref_kind: "sale",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  return { ok: true as const };
}

/** Cria um convite de cliente (link expira em 48h). Retorna o token. */
export async function createInvite(values: { name?: string; phone?: string; email?: string }) {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("client_invites").insert({
    tenant_id: user.tenantId,
    token,
    name: values.name ?? null,
    email: values.email ?? null,
    phone: values.phone ?? null,
    expires_at: expiresAt,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, token };
}

/** Cria uma campanha de marketing. */
export async function createCampaign(values: { name: string; segment: string; message: string }) {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
  const { error } = await supabase.from("campaigns").insert({
    tenant_id: user.tenantId,
    name: values.name,
    segment: values.segment,
    message: values.message,
    status: "ACTIVE",
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/marketing");
  return { ok: true as const };
}

/** Salva o branding (white-label) da unidade. */
export async function saveBranding(values: { accent?: string; instagram?: string }) {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
  const { error } = await supabase
    .from("branding")
    .update({ accent: values.accent ?? null, instagram: values.instagram ?? null })
    .eq("tenant_id", user.tenantId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/config");
  return { ok: true as const };
}

/** Atribui/renova um combo a um cliente (admin). */
export async function assignComboToClient(clientId: string, comboPlanId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("assign_combo", {
    p_client_id: clientId,
    p_combo_plan_id: comboPlanId,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/clientes");
  return { ok: true as const };
}

/** Registra um saque/retirada do caixa. */
export async function registerWithdrawal(amountBRL: number, note?: string) {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
  const { error } = await supabase.from("financial_entries").insert({
    tenant_id: user.tenantId,
    type: "WITHDRAWAL",
    amount_brl: amountBRL,
    ref_kind: "withdrawal",
    note: note ?? null,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/financeiro");
  return { ok: true as const };
}

/** Novo agendamento pelo admin — nasce CONFIRMED e consome 1 corte se for plano. */
export async function createAppointmentAdmin(input: {
  clientId: string;
  barberId: string | null;
  serviceId: string | null;
  comboPlanId: string | null;
  startAt: string;
  usePlan: boolean;
}) {
  if (!input.clientId || !input.startAt) return { ok: false as const, error: "Dados incompletos" };
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      tenant_id: user.tenantId,
      client_id: input.clientId,
      barber_id: input.barberId,
      service_id: input.usePlan ? null : input.serviceId,
      combo_plan_id: input.usePlan ? input.comboPlanId : null,
      start_at: input.startAt,
      status: "CONFIRMED",
      consumed_from_plan: input.usePlan,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  if (input.usePlan) {
    const { error: rpcErr } = await supabase.rpc("consume_cut", { p_client_id: input.clientId });
    if (rpcErr) {
      await supabase.from("appointments").delete().eq("id", data.id);
      return { ok: false as const, error: rpcErr.message };
    }
  }
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Aprova um pedido de plano (troca → assign_combo; cancelamento → CANCELLED). */
export async function approvePlanRequest(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: req } = await supabase
    .from("plan_requests")
    .select("client_id, type, combo_plan_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!req || req.status !== "PENDING") return { ok: false as const, error: "Pedido inválido" };

  if (req.type === "CHANGE" && req.combo_plan_id) {
    const { error } = await supabase.rpc("assign_combo", {
      p_client_id: req.client_id,
      p_combo_plan_id: req.combo_plan_id,
    });
    if (error) return { ok: false as const, error: error.message };
  } else if (req.type === "CANCEL") {
    const { error } = await supabase
      .from("client_subscriptions")
      .update({ status: "CANCELLED" })
      .eq("client_id", req.client_id)
      .eq("status", "ACTIVE");
    if (error) return { ok: false as const, error: error.message };
  }

  await supabase
    .from("plan_requests")
    .update({ status: "APPROVED", resolved_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/solicitacoes");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Recusa um pedido de plano (nada muda no plano). */
export async function rejectPlanRequest(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("plan_requests")
    .update({ status: "REJECTED", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "PENDING");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/solicitacoes");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Detalhe do cliente (para o drawer de visualização). */
export async function fetchClientDetail(id: string) {
  return getClientDetail(id);
}

/** Marca uma retirada de produto como entregue (PICKED_UP). */
export async function markReservationPickedUp(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("product_reservations")
    .update({ status: "PICKED_UP" })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/solicitacoes");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Cancela uma retirada de produto. */
export async function cancelReservation(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("product_reservations")
    .update({ status: "CANCELLED" })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/solicitacoes");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Inicia o atendimento (comanda) — dispara o cronômetro. */
export async function startService(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("appointments")
    .update({ service_started_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/agenda");
  return { ok: !error, error: error?.message };
}

/** Adiciona um item (serviço/produto) à comanda durante o atendimento. */
export async function addComandaItem(
  appointmentId: string,
  item: { kind: "service" | "product"; refId: string | null; name: string; priceBRL: number; qty: number; durationMin?: number }
) {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
  const { error } = await supabase.from("appointment_items").insert({
    appointment_id: appointmentId,
    tenant_id: user.tenantId,
    kind: item.kind,
    ref_id: item.refId,
    name: item.name,
    price_brl: item.priceBRL,
    qty: item.qty,
    duration_min: item.durationMin ?? 0,
    covered_by_plan: false,
  });
  revalidatePath("/admin/pedidos");
  return { ok: !error, error: error?.message };
}

/** Remove um item da comanda. */
export async function removeComandaItem(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("appointment_items").delete().eq("id", itemId);
  revalidatePath("/admin/pedidos");
  return { ok: !error, error: error?.message };
}

/** Finaliza a comanda: lança o total (exceto o coberto pelo plano) no financeiro e marca Atendido. */
export async function finalizeComanda(appointmentId: string, method: string) {
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("client_id, appointment_items(kind, ref_id, name, price_brl, qty, covered_by_plan)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return { ok: false as const, error: "Comanda não encontrada" };

  const items = (appt.appointment_items ?? []).filter((i) => !i.covered_by_plan);
  const total = items.reduce((s, i) => s + Number(i.price_brl) * i.qty, 0);

  if (total > 0) {
    const res = await createSale({
      clientId: (appt.client_id as string) ?? null,
      method,
      items: items.map((i) => ({
        kind: i.kind as "service" | "product",
        refId: (i.ref_id as string) ?? "",
        name: i.name as string,
        priceBRL: Number(i.price_brl),
        qty: i.qty as number,
      })),
    });
    if (!res.ok) return res;
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "DONE", service_ended_at: new Date().toISOString() })
    .eq("id", appointmentId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Salva a foto (avatar) de um cliente (upload feito no browser). */
export async function updateClientAvatar(clientId: string, avatarUrl: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("clients").update({ avatar_url: avatarUrl }).eq("id", clientId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/clientes");
  return { ok: true as const };
}

/** Cancelar (admin) — devolve o corte ao saldo se era do plano. */
export async function adminCancelAppointment(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("client_id, consumed_from_plan")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("appointments").update({ status: "CANCELLED" }).eq("id", id);
  if (!error && appt?.consumed_from_plan) {
    await supabase.rpc("return_cut", { p_client_id: appt.client_id });
  }
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  return { ok: !error, error: error?.message };
}
