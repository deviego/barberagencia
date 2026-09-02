"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getRequestOrigin } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { ACT_COOKIE, isUuid } from "@/lib/auth/acting";
import { REF_COOKIE } from "@/lib/partners/ref";

/** MASTER: dispara o envio do relatório mensal AGORA (WhatsApp), via gateway. */
export async function sendReportNow(ym?: string) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  const base = process.env.WA_SERVICE_URL;
  const token = process.env.WA_SERVICE_TOKEN;
  if (!base || !token) return { ok: false as const, error: "Gateway não configurado (WA_SERVICE_URL/TOKEN)." };
  try {
    const url = `${base.replace(/\/$/, "")}/report/run${ym ? `?ym=${encodeURIComponent(ym)}` : ""}`;
    const res = await fetch(url, { method: "POST", headers: { "x-wa-token": token }, signal: AbortSignal.timeout(60000) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; out?: { phone: string; ok: boolean; error?: string }[] };
    if (!res.ok || data.ok === false) return { ok: false as const, error: data.error || `Gateway respondeu ${res.status}` };
    return { ok: true as const, out: data.out ?? [] };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falha de rede" };
  }
}

/** MASTER: envia o relatório de UMA barbearia (período) para o WhatsApp dela. */
export async function sendBarbershopReport(tenantId: string, from?: string, to?: string) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  const base = process.env.WA_SERVICE_URL;
  const token = process.env.WA_SERVICE_TOKEN;
  if (!base || !token) return { ok: false as const, error: "Gateway não configurado (WA_SERVICE_URL/TOKEN)." };
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/report/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wa-token": token },
      body: JSON.stringify({ tenant: tenantId, from, to }),
      signal: AbortSignal.timeout(60000),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; phone?: string };
    if (!res.ok || data.ok === false) return { ok: false as const, error: data.error || `Gateway respondeu ${res.status}` };
    return { ok: true as const, phone: data.phone };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falha de rede" };
  }
}

function tempPassword() {
  return "Bb" + randomUUID().replace(/-/g, "").slice(0, 10) + "#7";
}

/**
 * Define (ou limpa) a barbearia que o MASTER está "atuando como" no painel admin.
 * Só MASTER. O banco só honra o override para MASTER (ver schema-actas.sql).
 */
export async function setActingTenant(tenantId: string | null) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };

  const jar = await cookies();
  if (!tenantId) {
    jar.delete(ACT_COOKIE);
    revalidatePath("/admin", "layout");
    return { ok: true as const };
  }

  if (!isUuid(tenantId)) return { ok: false as const, error: "Barbearia inválida." };

  const admin = createSupabaseAdminClient();
  const { data: exists } = await admin.from("tenants").select("id").eq("id", tenantId).maybeSingle();
  if (!exists) return { ok: false as const, error: "Barbearia não encontrada." };

  jar.set(ACT_COOKIE, tenantId, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/admin", "layout");
  return { ok: true as const };
}

/** Cria uma barbearia (tenant + branding + usuário admin). Somente MASTER. */
export async function createTenant(input: {
  name: string;
  subdomain: string;
  plan: string;
  adminEmail: string;
  adminName?: string;
  phone?: string;
  trialEnabled?: boolean;
  queueEnabled?: boolean;
  referredByPartnerId?: string;
  contract?: {
    legalName?: string;
    tradeName?: string;
    docType?: string;
    docNumber?: string;
    responsibleName?: string;
    responsibleCpf?: string;
    addressStreet?: string;
    addressCity?: string;
    addressState?: string;
    addressZip?: string;
  };
}) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };

  const name = input.name.trim();
  const subdomain = input.subdomain.trim().toLowerCase();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (!name || !subdomain || !adminEmail) return { ok: false as const, error: "Preencha nome, slug e e-mail do admin." };
  if (!/^[a-z0-9-]{2,40}$/.test(subdomain))
    return { ok: false as const, error: "Slug inválido (use apenas letras minúsculas, números e hífen)." };

  const admin = createSupabaseAdminClient();

  // Slug único
  const { data: exists } = await admin.from("tenants").select("id").eq("subdomain", subdomain).maybeSingle();
  if (exists) return { ok: false as const, error: "Já existe uma barbearia com esse slug." };

  // Parceiro que indicou: do form, ou fallback pelo cookie de afiliado (?ref=CODE).
  let referredByPartnerId: string | null = isUuid(input.referredByPartnerId) ? input.referredByPartnerId! : null;
  if (!referredByPartnerId) {
    const refCode = (await cookies()).get(REF_COOKIE)?.value;
    if (refCode) {
      const { data: partner } = await admin.from("partners").select("id").eq("ref_code", refCode).maybeSingle();
      if (partner) referredByPartnerId = partner.id as string;
    }
  }

  // 1) tenant + branding
  const baseRow = { name, subdomain, saas_plan: input.plan, status: "ACTIVE", queue_enabled: input.queueEnabled ?? false };
  let ins = await admin.from("tenants").insert({ ...baseRow, referred_by_partner_id: referredByPartnerId }).select("id").single();
  if (ins.error && /referred_by_partner_id/.test(ins.error.message)) {
    // Coluna ainda não existe (schema-24 não aplicado) — cria sem atribuição.
    ins = await admin.from("tenants").insert(baseRow).select("id").single();
  }
  const tenant = ins.data;
  if (ins.error || !tenant) return { ok: false as const, error: ins.error?.message ?? "Falha ao criar a barbearia." };

  await admin.from("branding").insert({
    tenant_id: tenant.id,
    logo_text: name.slice(0, 2).toUpperCase(),
  });

  // telefone da barbearia (opcional) — guarda em tenant_settings
  const phone = input.phone?.trim();
  if (phone) {
    await admin.from("tenant_settings").upsert({ tenant_id: tenant.id, phone }, { onConflict: "tenant_id" });
  }

  // contrato de assinatura (com dados legais + flag de teste)
  const trialEnabled = input.trialEnabled !== false; // default: com teste
  const now = new Date();
  const trialEnds = new Date(now.getTime() + (trialEnabled ? 15 * 24 * 60 * 60 * 1000 : 0));
  const c = input.contract ?? {};
  const clean = (s?: string) => (s && s.trim() ? s.trim() : null);
  await admin.from("tenant_contracts").upsert(
    {
      tenant_id: tenant.id,
      plan: input.plan,
      trial_enabled: trialEnabled,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      status: "PENDING",
      legal_name: clean(c.legalName),
      trade_name: clean(c.tradeName) ?? name,
      doc_type: clean(c.docType),
      doc_number: clean(c.docNumber),
      responsible_name: clean(c.responsibleName) ?? clean(input.adminName),
      responsible_cpf: clean(c.responsibleCpf),
      address_street: clean(c.addressStreet),
      address_city: clean(c.addressCity),
      address_state: clean(c.addressState),
      address_zip: clean(c.addressZip),
      contact_email: adminEmail,
      contact_phone: phone ?? null,
    },
    { onConflict: "tenant_id" }
  );

  // 2) usuário admin (o trigger cria client+membership no tenant novo via tenant_subdomain)
  const password = tempPassword();
  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.adminName ?? name, tenant_subdomain: subdomain },
  });
  if (uErr || !created?.user) {
    // desfaz o tenant se o usuário falhar
    await admin.from("tenants").delete().eq("id", tenant.id);
    return { ok: false as const, error: `Falha ao criar o admin: ${uErr?.message ?? "erro"}` };
  }

  // 3) promove o membership desse usuário nesse tenant a UNIT_ADMIN
  await admin
    .from("memberships")
    .update({ role: "UNIT_ADMIN" })
    .eq("user_id", created.user.id)
    .eq("tenant_id", tenant.id);

  // Link do painel admin (o tenant é resolvido pela membership no login) + link do cliente
  const origin = await getRequestOrigin();

  revalidatePath("/master");
  revalidatePath("/master/barbearias");
  return {
    ok: true as const,
    adminLoginUrl: `${origin}/admin/login`,
    clientLink: `${origin}/b/${subdomain}`,
    adminEmail,
    password,
    name,
    phone: phone ?? "",
  };
}
