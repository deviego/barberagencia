import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";

export type QueueBoardItem = {
  id: string;
  ticket: number;
  status: "WAITING" | "IN_SERVICE" | "DONE" | "LEFT";
  firstName: string;
  barber: string | null;
};

/** Painel/board da fila de hoje (números + 1º nome + barbeiro). Service-role, escopo do tenant. */
export async function getQueueBoard(tenantId: string): Promise<{ serving: QueueBoardItem[]; waiting: QueueBoardItem[] }> {
  const admin = createSupabaseAdminClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
  const { data } = await admin
    .from("queue_entries")
    .select("id, ticket_number, status, clients(name), barbers(name)")
    .eq("tenant_id", tenantId)
    .eq("day", today)
    .in("status", ["WAITING", "IN_SERVICE"])
    .order("ticket_number", { ascending: true });

  const map = (r: any): QueueBoardItem => ({
    id: r.id,
    ticket: r.ticket_number,
    status: r.status,
    firstName: ((r.clients?.name as string) ?? "").split(" ")[0] || "Cliente",
    barber: (r.barbers?.name as string) ?? null,
  });
  const rows = (data ?? []).map(map);
  return {
    serving: rows.filter((r) => r.status === "IN_SERVICE"),
    waiting: rows.filter((r) => r.status === "WAITING"),
  };
}

export type MyTicket = {
  id: string;
  ticket: number;
  status: "WAITING" | "IN_SERVICE" | "DONE" | "LEFT";
  serviceId: string | null;
  barberId: string | null;
};

/** Senha do cliente logado hoje (sob RLS). */
export async function getMyTicket(): Promise<MyTicket | null> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { data } = await supabase
    .from("queue_entries")
    .select("id, ticket_number, status, service_id, barber_id")
    .eq("day", today)
    .in("status", ["WAITING", "IN_SERVICE"])
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    ticket: data.ticket_number as number,
    status: data.status as MyTicket["status"],
    serviceId: (data.service_id as string) ?? null,
    barberId: (data.barber_id as string) ?? null,
  };
}

export type AdminQueueItem = {
  id: string;
  ticket: number;
  status: "WAITING" | "IN_SERVICE";
  clientName: string;
  service: string | null;
  barber: string | null;
  joinedAt: string;
};

/** Fila do admin (WAITING + IN_SERVICE de hoje), sob RLS. */
export async function getAdminQueue(): Promise<AdminQueueItem[]> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { data } = await supabase
    .from("queue_entries")
    .select("id, ticket_number, status, joined_at, clients(name), services(name), barbers(name)")
    .eq("day", today)
    .in("status", ["WAITING", "IN_SERVICE"])
    .order("ticket_number", { ascending: true });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    ticket: r.ticket_number,
    status: r.status,
    clientName: (r.clients?.name as string) ?? "Cliente",
    service: (r.services?.name as string) ?? null,
    barber: (r.barbers?.name as string) ?? null,
    joinedAt: r.joined_at,
  }));
}

/** Barbeiros que participam da fila (para o cliente escolher, se a flag permitir). */
export async function getQueueBarbers(tenantId: string): Promise<{ id: string; name: string }[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("barbers")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("accepts_queue", true)
    .order("name");
  return (data as { id: string; name: string }[] | null) ?? [];
}

/** Serviços ativos (para o cliente escolher na fila). */
export async function getQueueServices(tenantId: string): Promise<{ id: string; name: string; priceBrl: number }[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("services")
    .select("id, name, price_brl")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("name");
  return ((data as any[]) ?? []).map((s) => ({ id: s.id, name: s.name, priceBrl: s.price_brl }));
}

/** Config da fila do tenant (flag de escolher barbeiro + modo). */
export async function getQueueConfig(
  tenantId: string
): Promise<{ pickBarber: boolean; enabled: boolean; mode: "TOTEM" | "APP" | "BOTH"; planRequiresService: boolean }> {
  const admin = createSupabaseAdminClient();
  const [{ data: t }, { data: s }] = await Promise.all([
    admin.from("tenants").select("queue_enabled").eq("id", tenantId).maybeSingle(),
    admin.from("tenant_settings").select("queue_pick_barber, queue_mode, queue_plan_requires_service").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  return {
    enabled: Boolean(t?.queue_enabled),
    pickBarber: Boolean(s?.queue_pick_barber),
    mode: ((s?.queue_mode as string) ?? "APP") as "TOTEM" | "APP" | "BOTH",
    planRequiresService: Boolean(s?.queue_plan_requires_service),
  };
}

/** Token do totem do tenant (para montar o link nas Configurações). */
export async function getTotemToken(tenantId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("tenants").select("totem_token").eq("id", tenantId).maybeSingle();
  return (data?.totem_token as string) ?? null;
}

export type TotemData = {
  tenantId: string;
  name: string;
  mode: "TOTEM" | "APP" | "BOTH";
  pickBarber: boolean;
  planRequiresService: boolean;
  services: { id: string; name: string; priceBrl: number }[];
  barbers: { id: string; name: string }[];
};

/** Dados do totem — valida o token secreto. Retorna null se inválido. */
export async function getTotemData(slug: string, token: string): Promise<TotemData | null> {
  if (!slug || !token) return null;
  const admin = createSupabaseAdminClient();
  const { data: t } = await admin
    .from("tenants")
    .select("id, name, queue_enabled, totem_token")
    .eq("subdomain", slug)
    .maybeSingle();
  if (!t?.totem_token || t.totem_token !== token || !t.queue_enabled) return null;

  const [{ data: s }, services, barbers] = await Promise.all([
    admin.from("tenant_settings").select("queue_pick_barber, queue_mode, queue_plan_requires_service").eq("tenant_id", t.id).maybeSingle(),
    getQueueServices(t.id as string),
    getQueueBarbers(t.id as string),
  ]);
  const mode = ((s?.queue_mode as string) ?? "APP") as "TOTEM" | "APP" | "BOTH";
  if (mode === "APP") return null; // totem desativado neste modo
  const pickBarber = Boolean(s?.queue_pick_barber);
  return {
    tenantId: t.id as string,
    name: t.name as string,
    mode,
    pickBarber,
    planRequiresService: Boolean(s?.queue_plan_requires_service),
    services,
    barbers: pickBarber ? barbers : [],
  };
}
