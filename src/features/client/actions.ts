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
