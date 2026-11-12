"use server";

import { randomUUID, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isUnitAdmin } from "@/lib/rbac";
import { safeEqual } from "@/lib/crypto/safe-equal";
import { getRequestOrigin } from "@/lib/http";
import { notifyInvite } from "@/server/notifications/notify";
import { isUuid } from "@/lib/auth/acting";
import { ipTenantKey } from "@/lib/rate-limit";
import { hashIp, hitRateLimit, requestIp } from "@/server/rate-limit";
import {
  TOTEM_ERRORS,
  TOTEM_LIMITS,
  TOTEM_RATE_SCOPES,
  TotemRegisterSchema,
  totemJoinErrorMessage,
  totemPhoneDigits,
} from "./totem-rules";

/** Sessão de admin da barbearia (UNIT_ADMIN+ ou MASTER). Retorna o tenantId ou null. */
async function requireAdminTenant() {
  const user = await getSessionUser();
  if (!user?.tenantId || !user.role || !isUnitAdmin(user.role)) return null;
  return user.tenantId;
}

/** Valida slug + token do totem. Retorna o tenant (id/name/flags) ou null. */
async function validateTotem(slug: string, token: string) {
  if (!slug || !token) return null;
  const admin = createSupabaseAdminClient();
  const { data: t } = await admin
    .from("tenants")
    .select("id, name, totem_token")
    .eq("subdomain", slug)
    .maybeSingle();
  if (!t || !safeEqual(t.totem_token as string | null, token)) return null;
  return { id: t.id as string, name: t.name as string };
}

type TotemFail = { ok: false; error: string };
const fail = (error: string): TotemFail => ({ ok: false, error });

/** Limite de tentativas por IP da hospedagem + barbearia. Retorna o erro a devolver, ou null se liberado. */
async function totemRateLimit(action: "lookup" | "register" | "join", tenantId: string): Promise<TotemFail | null> {
  const ipHash = hashIp(await requestIp());
  if (!ipHash) {
    console.error("[totem] LEAD_IP_SALT ausente ou curto; ação recusada");
    return fail(TOTEM_ERRORS.unavailable);
  }
  const res = await hitRateLimit(TOTEM_RATE_SCOPES[action], ipTenantKey(ipHash, tenantId), TOTEM_LIMITS[action]);
  if (res === "limited") return fail(TOTEM_ERRORS.rateLimited);
  if (res === "unavailable") return fail(TOTEM_ERRORS.unavailable);
  return null;
}

/** Resolve o cliente pelo telefone DENTRO da barbearia do totem. O id nunca sai do servidor. */
async function findTotemClient(tenantId: string, digits: string): Promise<{ id: string; name: string } | null | "error"> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("totem_find_client", { p_tenant: tenantId, p_digits: digits });
  if (error) return "error";
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { id: row.id as string, name: row.name as string } : null;
}

/** true se o id (serviço ou barbeiro) é da barbearia. */
async function belongsToTenant(table: "services" | "barbers", id: string, tenantId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from(table).select("id").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
  return !error && !!data;
}

/** Busca cliente por telefone na barbearia + info de plano. */
export async function totemLookup(slug: string, token: string, phone: string) {
  const tenant = await validateTotem(slug, token);
  if (!tenant) return fail(TOTEM_ERRORS.invalidTotem);
  const digits = totemPhoneDigits(phone);
  if (!digits) return fail(TOTEM_ERRORS.invalidPhone);
  const limited = await totemRateLimit("lookup", tenant.id);
  if (limited) return limited;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("totem_lookup_client", { p_tenant: tenant.id, p_digits: digits });
  if (error) {
    console.error(`[totem] busca falhou (${error.code ?? "sem código"})`);
    return fail(TOTEM_ERRORS.unavailable);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: true as const, found: false as const };
  return {
    ok: true as const,
    found: true as const,
    name: row.name as string,
    hasPlan: Boolean(row.has_plan),
    planName: (row.plan_name as string) ?? null,
  };
}

/** Cadastro rápido pelo totem: cria o cliente + boas-vindas no WhatsApp (link do app). */
export async function totemRegister(
  slug: string,
  token: string,
  input: { phone: string; name: string; birthDate?: string | null }
) {
  const tenant = await validateTotem(slug, token);
  if (!tenant) return fail(TOTEM_ERRORS.invalidTotem);
  const digits = totemPhoneDigits(input?.phone);
  if (!digits) return fail(TOTEM_ERRORS.invalidPhone);
  const parsed = TotemRegisterSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fail(field === "name" ? TOTEM_ERRORS.invalidName : TOTEM_ERRORS.registerFailed);
  }
  const { name, birthDate } = parsed.data;
  const phone = parsed.data.phone.trim();
  const limited = await totemRateLimit("register", tenant.id);
  if (limited) return limited;

  // Já existe (dedupe por telefone)? retorna.
  const existing = await findTotemClient(tenant.id, digits);
  if (existing === "error") return fail(TOTEM_ERRORS.registerFailed);
  if (existing) return { ok: true as const, name: existing.name };

  const admin = createSupabaseAdminClient();
  const { data: client, error } = await admin
    .from("clients")
    .insert({
      tenant_id: tenant.id,
      name,
      phone,
      birth_date: birthDate || null,
      status: "INVITED",
    })
    .select("name")
    .single();
  if (error || !client) {
    console.error(`[totem] cadastro falhou (${error?.code ?? "sem código"})`);
    return fail(TOTEM_ERRORS.registerFailed);
  }

  // Convite/boas-vindas no WhatsApp com link do app (best-effort).
  // Acima do teto diário da barbearia (ou sem conseguir conferir), o cadastro vale e nada é enviado.
  try {
    const invite = await hitRateLimit(TOTEM_RATE_SCOPES.invite, tenant.id, TOTEM_LIMITS.invitesPerTenantDay);
    if (invite === "ok") {
      const inviteToken = randomUUID();
      await admin.from("client_invites").insert({
        tenant_id: tenant.id,
        token: inviteToken,
        name,
        phone,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });
      const origin = await getRequestOrigin();
      const link = origin ? `${origin}/convite/${inviteToken}` : "";
      await notifyInvite({ name, phone, email: null, tenantName: tenant.name, tenantId: tenant.id, link });
    }
  } catch {
    /* boas-vindas não bloqueiam o cadastro */
  }

  return { ok: true as const, name: client.name as string };
}

/** Gera a senha da fila pelo totem. O cliente é resolvido no servidor a partir do telefone. */
export async function totemJoinQueue(
  slug: string,
  token: string,
  phone: string,
  serviceId?: string | null,
  barberId?: string | null
) {
  const tenant = await validateTotem(slug, token);
  if (!tenant) return fail(TOTEM_ERRORS.invalidTotem);
  const digits = totemPhoneDigits(phone);
  if (!digits) return fail(TOTEM_ERRORS.invalidPhone);
  const service = serviceId || null;
  const barber = barberId || null;
  if ((service && !isUuid(service)) || (barber && !isUuid(barber))) return fail(TOTEM_ERRORS.invalidChoice);
  const limited = await totemRateLimit("join", tenant.id);
  if (limited) return limited;

  const client = await findTotemClient(tenant.id, digits);
  if (client === "error") return fail(TOTEM_ERRORS.joinFailed);
  if (!client) return fail(TOTEM_ERRORS.clientNotFound);

  // Pertencimento conferido aqui também (a função do banco confere de novo).
  const [serviceOk, barberOk] = await Promise.all([
    service ? belongsToTenant("services", service, tenant.id) : true,
    barber ? belongsToTenant("barbers", barber, tenant.id) : true,
  ]);
  if (!serviceOk || !barberOk) return fail(TOTEM_ERRORS.invalidChoice);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("join_queue_totem", {
    p_tenant_id: tenant.id,
    p_client_id: client.id,
    p_service_id: service,
    p_barber_id: barber,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || typeof row?.ticket_number !== "number") {
    if (error) console.error(`[totem] senha falhou (${error.code ?? "sem código"})`);
    return fail(totemJoinErrorMessage(error?.message));
  }
  return { ok: true as const, ticket: row.ticket_number as number };
}

/** ADMIN (UNIT_ADMIN+/MASTER): regenera o token do totem (invalida o link antigo). */
export async function regenerateTotemToken() {
  const tenantId = await requireAdminTenant();
  if (!tenantId) return { ok: false as const, error: "Acesso negado." };
  const admin = createSupabaseAdminClient();
  const token = randomBytes(24).toString("hex");
  const { error } = await admin.from("tenants").update({ totem_token: token }).eq("id", tenantId);
  if (error) return { ok: false as const, error: "Não foi possível salvar. Tente de novo." };
  return { ok: true as const, token };
}

/** ADMIN (UNIT_ADMIN+/MASTER): modo da fila (TOTEM | APP | BOTH). */
export async function setQueueMode(mode: "TOTEM" | "APP" | "BOTH") {
  const tenantId = await requireAdminTenant();
  if (!tenantId) return { ok: false as const, error: "Acesso negado." };
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("tenant_settings")
    .upsert({ tenant_id: tenantId, queue_mode: mode }, { onConflict: "tenant_id" });
  if (error) return { ok: false as const, error: "Não foi possível salvar. Tente de novo." };
  return { ok: true as const };
}

/** ADMIN (UNIT_ADMIN+/MASTER): cliente de plano também escolhe serviço no totem. */
export async function setQueuePlanRequiresService(enabled: boolean) {
  const tenantId = await requireAdminTenant();
  if (!tenantId) return { ok: false as const, error: "Acesso negado." };
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("tenant_settings")
    .upsert({ tenant_id: tenantId, queue_plan_requires_service: enabled }, { onConflict: "tenant_id" });
  if (error) return { ok: false as const, error: "Não foi possível salvar. Tente de novo." };
  return { ok: true as const };
}
