import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { safeEqual } from "@/lib/crypto/safe-equal";

export type QueueBoardItem = {
  id: string;
  ticket: number;
  status: "WAITING" | "IN_SERVICE" | "DONE" | "LEFT";
  firstName: string;
  barber: string | null;
  calledAt?: string | null;
  hasPlan: boolean;
  planName: string | null;
};

type PgClient = ReturnType<typeof createSupabaseAdminClient>;
/** Mapa client_id -> nome do plano (null se sem nome) para assinaturas ATIVAS. */
async function activePlansByClient(client: PgClient, ids: (string | null | undefined)[]): Promise<Map<string, string | null>> {
  const uniq = [...new Set(ids.filter(Boolean) as string[])];
  const m = new Map<string, string | null>();
  if (!uniq.length) return m;
  const { data } = await client
    .from("client_subscriptions")
    .select("client_id, combo_plans(name)")
    .eq("status", "ACTIVE")
    .in("client_id", uniq);
  for (const r of (data ?? []) as any[]) m.set(r.client_id as string, (r.combo_plans?.name as string) ?? null);
  return m;
}

/** Painel/board da fila de hoje (números + 1º nome + barbeiro + selo de plano). Service-role. */
export async function getQueueBoard(tenantId: string): Promise<{
  serving: QueueBoardItem[];
  waiting: QueueBoardItem[];
  next: QueueBoardItem | null;
  lastDone: QueueBoardItem | null;
  lastCalled: QueueBoardItem | null;
  doneCount: number;
}> {
  const admin = createSupabaseAdminClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD

  const map = (r: any): QueueBoardItem => ({
    id: r.id,
    ticket: r.ticket_number,
    status: r.status,
    firstName: ((r.clients?.name as string) ?? "").split(" ")[0] || "Cliente",
    barber: (r.barbers?.name as string) ?? null,
    calledAt: (r.called_at as string) ?? null,
    hasPlan: false,
    planName: null,
  });

  const [{ data }, { data: doneRows, count: doneCount }] = await Promise.all([
    admin
      .from("queue_entries")
      .select("id, ticket_number, status, called_at, client_id, clients(name), barbers(name)")
      .eq("tenant_id", tenantId)
      .eq("day", today)
      .in("status", ["WAITING", "IN_SERVICE"])
      .order("ticket_number", { ascending: true }),
    admin
      .from("queue_entries")
      .select("id, ticket_number, status, client_id, clients(name), barbers(name)", { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("day", today)
      .eq("status", "DONE")
      .order("ended_at", { ascending: false })
      .limit(1),
  ]);

  const rawRows = (data ?? []) as any[];
  const rawDone = (doneRows ?? []) as any[];
  const rows = rawRows.map(map);
  const lastDone = rawDone.map(map)[0] ?? null;

  // Selo de plano (assinatura ativa) por cliente.
  const plans = await activePlansByClient(admin, [...rawRows, ...rawDone].map((r) => r.client_id));
  const flag = (item: QueueBoardItem | null, clientId: string | undefined) => {
    if (!item || !clientId || !plans.has(clientId)) return;
    item.hasPlan = true;
    item.planName = plans.get(clientId) ?? null;
  };
  rows.forEach((item, i) => flag(item, rawRows[i]?.client_id));
  flag(lastDone, rawDone[0]?.client_id);

  const waiting = rows.filter((r) => r.status === "WAITING");
  // Senha "chamada" mais recente (WAITING com called_at) — dispara o alerta no painel.
  const lastCalled =
    waiting
      .filter((r) => r.calledAt)
      .sort((a, b) => new Date(b.calledAt!).getTime() - new Date(a.calledAt!).getTime())[0] ?? null;
  // Próxima a ser chamada: primeira aguardando ainda não chamada (senão a 1ª da fila).
  const next = waiting.find((r) => !r.calledAt) ?? waiting[0] ?? null;

  return {
    serving: rows.filter((r) => r.status === "IN_SERVICE"),
    waiting,
    next,
    lastDone,
    lastCalled,
    doneCount: doneCount ?? 0,
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
  hasPlan: boolean;
  planName: string | null;
};

/** Fila do admin (WAITING + IN_SERVICE de hoje), sob RLS. */
export async function getAdminQueue(): Promise<AdminQueueItem[]> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { data } = await supabase
    .from("queue_entries")
    .select("id, ticket_number, status, joined_at, client_id, clients(name), services(name), barbers(name)")
    .eq("day", today)
    .in("status", ["WAITING", "IN_SERVICE"])
    .order("ticket_number", { ascending: true });
  const rows = (data ?? []) as any[];
  const plans = await activePlansByClient(supabase as unknown as PgClient, rows.map((r) => r.client_id));
  return rows.map((r) => ({
    id: r.id,
    ticket: r.ticket_number,
    status: r.status,
    clientName: (r.clients?.name as string) ?? "Cliente",
    service: (r.services?.name as string) ?? null,
    barber: (r.barbers?.name as string) ?? null,
    joinedAt: r.joined_at,
    hasPlan: plans.has(r.client_id),
    planName: plans.get(r.client_id) ?? null,
  }));
}

export type QueueDay = { day: string; total: number; done: number; left: number; waiting: number };
export type QueueHistory = { today: QueueDay; days: QueueDay[] };

const emptyDay = (day: string): QueueDay => ({ day, total: 0, done: 0, left: 0, waiting: 0 });

/**
 * Histórico diário das senhas da fila (últimos `days` dias, fuso America/Sao_Paulo).
 * Retorna o resumo de hoje + a lista de dias COM movimento (mais recente primeiro).
 * Sob RLS (política de admin do tenant).
 */
export async function getQueueHistory(days = 14): Promise<QueueHistory> {
  const supabase = await createSupabaseServerClient();
  const tz = "America/Sao_Paulo";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  // início do período (today - (days-1)), calculado ao meio-dia UTC p/ evitar deslize de fuso.
  const startDate = new Date(`${today}T12:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
  const startDay = startDate.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("queue_entries")
    .select("day, status")
    .gte("day", startDay)
    .lte("day", today)
    .order("day", { ascending: false });

  const map = new Map<string, QueueDay>();
  for (const r of (data ?? []) as { day: string; status: string }[]) {
    const d = map.get(r.day) ?? emptyDay(r.day);
    d.total += 1;
    if (r.status === "DONE") d.done += 1;
    else if (r.status === "LEFT") d.left += 1;
    else d.waiting += 1; // WAITING | IN_SERVICE (ainda em aberto)
    map.set(r.day, d);
  }

  const daysList = [...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  return { today: map.get(today) ?? emptyDay(today), days: daysList };
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
  if (!t?.queue_enabled || !safeEqual(t?.totem_token as string | null, token)) return null;

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
