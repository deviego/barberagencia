"use server";

import { randomUUID, randomBytes } from "crypto";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { notifyInvite } from "@/server/notifications/notify";

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

/** Valida slug + token do totem. Retorna o tenant (id/name/flags) ou null. */
async function validateTotem(slug: string, token: string) {
  if (!slug || !token) return null;
  const admin = createSupabaseAdminClient();
  const { data: t } = await admin
    .from("tenants")
    .select("id, name, totem_token")
    .eq("subdomain", slug)
    .maybeSingle();
  if (!t?.totem_token || t.totem_token !== token) return null;
  return { id: t.id as string, name: t.name as string };
}

/** Busca cliente por telefone na barbearia + info de plano. */
export async function totemLookup(slug: string, token: string, phone: string) {
  const tenant = await validateTotem(slug, token);
  if (!tenant) return { ok: false as const, error: "Totem inválido." };
  const digits = onlyDigits(phone);
  if (digits.length < 10) return { ok: false as const, error: "Telefone inválido." };

  const admin = createSupabaseAdminClient();
  const { data } = await admin.rpc("totem_find_client", { p_tenant: tenant.id, p_digits: digits });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: true as const, found: false as const };
  return {
    ok: true as const,
    found: true as const,
    clientId: row.id as string,
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
  if (!tenant) return { ok: false as const, error: "Totem inválido." };
  const name = input.name?.trim();
  const digits = onlyDigits(input.phone);
  if (!name) return { ok: false as const, error: "Informe o nome." };
  if (digits.length < 10) return { ok: false as const, error: "Telefone inválido." };
  const phone = input.phone.trim();

  const admin = createSupabaseAdminClient();

  // Já existe (dedupe por telefone)? retorna.
  const dup = await admin.rpc("totem_find_client", { p_tenant: tenant.id, p_digits: digits });
  const existing = Array.isArray(dup.data) ? dup.data[0] : dup.data;
  if (existing) return { ok: true as const, clientId: existing.id as string, name: existing.name as string };

  const { data: client, error } = await admin
    .from("clients")
    .insert({
      tenant_id: tenant.id,
      name,
      phone,
      birth_date: input.birthDate || null,
      status: "INVITED",
    })
    .select("id, name")
    .single();
  if (error || !client) return { ok: false as const, error: error?.message ?? "Falha ao cadastrar." };

  // Convite/boas-vindas no WhatsApp com link do app (best-effort).
  try {
    const inviteToken = randomUUID();
    await admin.from("client_invites").insert({
      tenant_id: tenant.id,
      token: inviteToken,
      name,
      phone,
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });
    const h = await headers();
    const host = h.get("host") ?? "";
    const proto = host.includes("localhost") ? "http" : "https";
    const link = host ? `${proto}://${host}/convite/${inviteToken}` : "";
    await notifyInvite({ name, phone, email: null, tenantName: tenant.name, tenantId: tenant.id, link });
  } catch {
    /* boas-vindas não bloqueiam o cadastro */
  }

  return { ok: true as const, clientId: client.id as string, name: client.name as string };
}

/** Gera a senha da fila pelo totem (em nome do cliente). */
export async function totemJoinQueue(
  slug: string,
  token: string,
  clientId: string,
  serviceId?: string | null,
  barberId?: string | null
) {
  const tenant = await validateTotem(slug, token);
  if (!tenant) return { ok: false as const, error: "Totem inválido." };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("join_queue_totem", {
    p_tenant_id: tenant.id,
    p_client_id: clientId,
    p_service_id: serviceId ?? null,
    p_barber_id: barberId ?? null,
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, ticket: row?.ticket_number as number, id: row?.id as string };
}

/** MASTER/ADMIN: regenera o token do totem (invalida o link antigo). */
export async function regenerateTotemToken() {
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
  const admin = createSupabaseAdminClient();
  const token = randomBytes(24).toString("hex");
  const { error } = await admin.from("tenants").update({ totem_token: token }).eq("id", user.tenantId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, token };
}

/** ADMIN: modo da fila (TOTEM | APP | BOTH). */
export async function setQueueMode(mode: "TOTEM" | "APP" | "BOTH") {
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("tenant_settings")
    .upsert({ tenant_id: user.tenantId, queue_mode: mode }, { onConflict: "tenant_id" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/** ADMIN: cliente de plano também escolhe serviço no totem. */
export async function setQueuePlanRequiresService(enabled: boolean) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("tenant_settings")
    .upsert({ tenant_id: user.tenantId, queue_plan_requires_service: enabled }, { onConflict: "tenant_id" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
