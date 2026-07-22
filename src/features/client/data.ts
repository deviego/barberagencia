import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Cliente (linha `clients`) do usuário logado no tenant atual. */
export async function getMyClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("clients")
    .select("id, tenant_id, name, email, phone, avatar_url")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return data;
}

/** Dados da Home do cliente: perfil, assinatura+saldo e próximo agendamento. */
export async function getClientHome() {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return null;

  const { data: sub } = await supabase
    .from("client_subscriptions")
    .select("combo_plan_id, saldo_cortes, billing_day, status, combo_plans(name, cuts, scope, price_brl)")
    .eq("client_id", client.id)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  const { data: next } = await supabase
    .from("appointments")
    .select("id, start_at, status, barbers(name), services(name), combo_plans(name)")
    .eq("client_id", client.id)
    .in("status", ["REQUESTED", "CONFIRMED", "ALT_OFFERED"])
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { client, sub, next };
}

/** Horários de trabalho dos barbeiros do tenant (para gerar disponibilidade). */
export async function getWorkingHours() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("working_hours")
    .select("barber_id, weekday, start_min, end_min");
  return data ?? [];
}

/** Saldo de cortes da assinatura ATIVA do cliente logado (null se não tiver plano). */
export async function getActivePlanBalance(): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return null;
  const { data } = await supabase
    .from("client_subscriptions")
    .select("saldo_cortes")
    .eq("client_id", client.id)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();
  return data ? (data.saldo_cortes as number) : null;
}

/** Catálogo do tenant: serviços, combos e barbeiros ativos. */
export async function getCatalog() {
  const supabase = await createSupabaseServerClient();
  const [services, combos, barbers] = await Promise.all([
    supabase.from("services").select("id, name, duration_min, price_brl").eq("active", true).order("price_brl"),
    supabase.from("combo_plans").select("id, name, cuts, scope, price_brl").eq("active", true).order("price_brl"),
    supabase.from("barbers").select("id, name").eq("active", true).order("name"),
  ]);
  return {
    services: services.data ?? [],
    combos: combos.data ?? [],
    barbers: barbers.data ?? [],
  };
}

/** Meu plano: assinatura ativa + histórico de uso (cortes consumidos do plano). */
export async function getMyPlan() {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return null;
  const { data: sub } = await supabase
    .from("client_subscriptions")
    .select("saldo_cortes, billing_day, status, combo_plans(name, cuts, scope, price_brl)")
    .eq("client_id", client.id)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();
  const { data: usage } = await supabase
    .from("appointments")
    .select("id, start_at, status, services(name), combo_plans(name), barbers(name)")
    .eq("client_id", client.id)
    .eq("consumed_from_plan", true)
    .order("start_at", { ascending: false })
    .limit(10);
  const { data: request } = await supabase
    .from("plan_requests")
    .select("id, type, created_at, combo_plans(name)")
    .eq("client_id", client.id)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { sub, usage: usage ?? [], request };
}

/** Um agendamento do cliente, para a tela de reagendamento. */
export async function getAppointmentForReschedule(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, start_at, status, barber_id, service_id, combo_plan_id, consumed_from_plan, barbers(name), services(name), combo_plans(name)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Perfil do cliente (auth + profile + client). */
export async function getProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, client] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, avatar_url").eq("id", user.id).maybeSingle(),
    getMyClient(),
  ]);
  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    avatarUrl: (profile?.avatar_url as string | null) ?? (client?.avatar_url as string | null) ?? null,
    client,
  };
}

/** Catálogo de produtos ativos do tenant. */
export async function getProducts() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, price_brl")
    .eq("active", true)
    .order("name");
  return data ?? [];
}

/** Agendamentos do cliente (próximos + passados). */
export async function getMyAppointments() {
  const supabase = await createSupabaseServerClient();
  const client = await getMyClient();
  if (!client) return { upcoming: [], past: [] };
  const nowIso = new Date().toISOString();
  const [up, past] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, start_at, status, barbers(name), services(name), combo_plans(name)")
      .eq("client_id", client.id)
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true }),
    supabase
      .from("appointments")
      .select("id, start_at, status, barbers(name), services(name), combo_plans(name)")
      .eq("client_id", client.id)
      .lt("start_at", nowIso)
      .order("start_at", { ascending: false })
      .limit(10),
  ]);
  return { upcoming: up.data ?? [], past: past.data ?? [] };
}
