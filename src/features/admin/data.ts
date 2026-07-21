import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Solicitações de agendamento (REQUESTED) do tenant do admin. */
export async function listRequests() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, start_at, status, request_expires_at, consumed_from_plan, clients(name), barbers(name), services(name), combo_plans(name)"
    )
    .eq("status", "REQUESTED")
    .order("start_at", { ascending: true });
  return data ?? [];
}

/** Leitores de CRUD (admin, sob RLS do tenant). */
export async function getServices() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("services")
    .select("id, name, duration_min, price_brl, category, active")
    .order("name");
  return data ?? [];
}
export async function getProducts() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, sku, price_brl, cost_brl, stock, active")
    .order("name");
  return data ?? [];
}
export async function getBarbers() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("barbers").select("id, name, active").order("name");
  return data ?? [];
}
export async function getClients() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, email, phone, active")
    .order("name");
  return data ?? [];
}

/** Agenda do dia (todos os status ativos) do tenant. */
export async function getTodayAppointments() {
  const supabase = await createSupabaseServerClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data } = await supabase
    .from("appointments")
    .select("id, start_at, status, clients(name), barbers(name), services(name), combo_plans(name)")
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString())
    .order("start_at", { ascending: true });
  return data ?? [];
}
