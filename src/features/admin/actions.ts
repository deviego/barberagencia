"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
