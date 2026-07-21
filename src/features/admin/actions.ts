"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

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

/** Aceitar solicitação → CONFIRMED (notificação = stub por ora). */
export async function acceptAppointment(id: string) {
  return setStatus(id, "CONFIRMED");
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
