"use server";

import { randomUUID, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isUnitAdmin } from "@/lib/rbac";
import { getRequestOrigin } from "@/lib/http";
import { notifyInvite } from "@/server/notifications/notify";
import { isUuid } from "@/lib/auth/acting";
import { ipTenantKey } from "@/lib/rate-limit";
import { hashIp, hitRateLimit, requestIp } from "@/server/rate-limit";
import { resolveTotemTenant } from "./data";
import {
  TOTEM_ERRORS,
  TOTEM_LIMITS,
  TOTEM_RATE_SCOPES,
  TOTEM_TENANT_CAPS,
  TOTEM_TENANT_CAP_LOG,
  totemNameError,
  TotemRegisterSchema,
  totemJoinErrorMessage,
  totemName,
  totemPhoneDigits,
  totemPhoneToStore,
} from "./totem-rules";

/** Sessão de admin da barbearia (UNIT_ADMIN+ ou MASTER). Retorna o tenantId ou null. */
async function requireAdminTenant() {
  const user = await getSessionUser();
  if (!user?.tenantId || !user.role || !isUnitAdmin(user.role)) return null;
  return user.tenantId;
}

type TotemFail = { ok: false; error: string };
const fail = (error: string): TotemFail => ({ ok: false, error });

/**
 * Limite de tentativas: por IP da hospedagem + barbearia e um teto por barbearia somando todas
 * as origens (nas três ações). Retorna o erro a devolver, ou null se liberado.
 *   - Sem RATE_LIMIT_IP_SALT: a camada por IP é pulada (com alerta); os tetos por barbearia valem.
 *   - Sem conseguir conferir no banco (ex.: schema-50 não aplicada): recusa.
 */
async function totemRateLimit(action: "lookup" | "register" | "join", tenantId: string): Promise<TotemFail | null> {
  const ipHash = hashIp(await requestIp());
  if (ipHash) {
    const res = await hitRateLimit(TOTEM_RATE_SCOPES[action], ipTenantKey(ipHash, tenantId), TOTEM_LIMITS[action]);
    if (res === "limited") return fail(TOTEM_ERRORS.rateLimited);
    if (res === "unavailable") return fail(TOTEM_ERRORS.unavailable);
  } else {
    console.error(`[totem] RATE_LIMIT_IP_SALT ausente ou curto; limite por IP pulado em ${action}`);
  }

  const cap = await hitRateLimit(TOTEM_RATE_SCOPES[`${action}Tenant`], tenantId, TOTEM_TENANT_CAPS[action]);
  if (cap === "limited") {
    console.error(`${TOTEM_TENANT_CAP_LOG} acao=${action} tenant=${tenantId}`);
    return fail(TOTEM_ERRORS.unavailable);
  }
  if (cap === "unavailable") return fail(TOTEM_ERRORS.unavailable);
  return null;
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Busca do totem (nome + plano) pela regra única de totem_resolve_client_id.
 * null = não cadastrado; "error" = não foi possível consultar.
 */
async function lookupTotemClient(admin: AdminClient, tenantId: string, digits: string) {
  const { data, error } = await admin.rpc("totem_lookup_client", { p_tenant: tenantId, p_digits: digits });
  if (error) {
    console.error(`[totem] busca falhou (${error.code ?? "sem código"})`);
    return "error" as const;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { name: row.name as string, hasPlan: Boolean(row.has_plan), planName: (row.plan_name as string) ?? null };
}

/** Serviço oferecido no totem: da barbearia e ativo (mesmo filtro de getQueueServices). */
async function isOfferedService(admin: AdminClient, id: string, tenantId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("services")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .maybeSingle();
  return !error && !!data;
}

/** Barbeiro oferecido no totem: da barbearia, ativo e que atende fila (mesmo filtro de getQueueBarbers). */
async function isOfferedBarber(admin: AdminClient, id: string, tenantId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("barbers")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("accepts_queue", true)
    .maybeSingle();
  return !error && !!data;
}

/** Busca cliente por telefone na barbearia + info de plano. */
export async function totemLookup(slug: string, token: string, phone: string) {
  const tenant = await resolveTotemTenant(slug, token);
  if (!tenant) return fail(TOTEM_ERRORS.invalidTotem);
  const digits = totemPhoneDigits(phone);
  if (!digits) return fail(TOTEM_ERRORS.invalidPhone);
  const limited = await totemRateLimit("lookup", tenant.id);
  if (limited) return limited;

  const found = await lookupTotemClient(createSupabaseAdminClient(), tenant.id, digits);
  if (found === "error") return fail(TOTEM_ERRORS.unavailable);
  if (!found) return { ok: true as const, found: false as const };
  return { ok: true as const, found: true as const, ...found };
}

/** Cadastro rápido pelo totem: cria o cliente + boas-vindas no WhatsApp (link do app). */
export async function totemRegister(
  slug: string,
  token: string,
  input: { phone: string; name: string; birthDate?: string | null }
) {
  const tenant = await resolveTotemTenant(slug, token);
  if (!tenant) return fail(TOTEM_ERRORS.invalidTotem);
  const digits = totemPhoneDigits(input?.phone);
  if (!digits) return fail(TOTEM_ERRORS.invalidPhone);
  const parsed = TotemRegisterSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fail(field === "birthDate" ? TOTEM_ERRORS.invalidDate : TOTEM_ERRORS.registerFailed);
  }
  const checkedName = totemName(parsed.data.name);
  if (!checkedName.ok) {
    return fail(totemNameError(checkedName.reason));
  }
  const name = checkedName.name;
  const phone = totemPhoneToStore(digits);
  const limited = await totemRateLimit("register", tenant.id);
  if (limited) return limited;

  const admin = createSupabaseAdminClient();

  // Já existe (dedupe por telefone)? retorna.
  const existing = await lookupTotemClient(admin, tenant.id, digits);
  if (existing === "error") return fail(TOTEM_ERRORS.registerFailed);
  if (existing) return { ok: true as const, name: existing.name };

  const { data: client, error } = await admin
    .from("clients")
    .insert({
      tenant_id: tenant.id,
      name,
      phone,
      birth_date: parsed.data.birthDate || null,
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
  const tenant = await resolveTotemTenant(slug, token);
  if (!tenant) return fail(TOTEM_ERRORS.invalidTotem);
  const digits = totemPhoneDigits(phone);
  if (!digits) return fail(TOTEM_ERRORS.invalidPhone);
  const service = serviceId || null;
  const barber = barberId || null;
  if ((service && !isUuid(service)) || (barber && !isUuid(barber))) return fail(TOTEM_ERRORS.invalidChoice);
  // Barbeiro só é oferecido quando a barbearia liga a escolha de barbeiro.
  if (barber && !tenant.pickBarber) return fail(TOTEM_ERRORS.invalidChoice);
  const limited = await totemRateLimit("join", tenant.id);
  if (limited) return limited;

  const admin = createSupabaseAdminClient();

  // Mesma regra da busca (totem_resolve_client_id): o id nunca sai do servidor.
  const resolved = await admin.rpc("totem_resolve_client_id", { p_tenant: tenant.id, p_digits: digits });
  if (resolved.error) {
    console.error(`[totem] cliente não resolvido (${resolved.error.code ?? "sem código"})`);
    return fail(TOTEM_ERRORS.joinFailed);
  }
  const clientId = typeof resolved.data === "string" ? resolved.data : null;
  if (!clientId) return fail(TOTEM_ERRORS.clientNotFound);

  // Serviço e barbeiro conferidos aqui também (a função do banco confere de novo).
  const [serviceOk, barberOk] = await Promise.all([
    service ? isOfferedService(admin, service, tenant.id) : true,
    barber ? isOfferedBarber(admin, barber, tenant.id) : true,
  ]);
  if (!serviceOk || !barberOk) return fail(TOTEM_ERRORS.invalidChoice);

  const { data, error } = await admin.rpc("join_queue_totem", {
    p_tenant_id: tenant.id,
    p_client_id: clientId,
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
