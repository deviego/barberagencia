"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { ACT_COOKIE, isUuid } from "@/lib/auth/acting";

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

  // 1) tenant + branding
  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .insert({ name, subdomain, saas_plan: input.plan, status: "ACTIVE" })
    .select("id")
    .single();
  if (tErr || !tenant) return { ok: false as const, error: tErr?.message ?? "Falha ao criar a barbearia." };

  await admin.from("branding").insert({
    tenant_id: tenant.id,
    logo_text: name.slice(0, 2).toUpperCase(),
  });

  // telefone da barbearia (opcional) — guarda em tenant_settings
  const phone = input.phone?.trim();
  if (phone) {
    await admin.from("tenant_settings").upsert({ tenant_id: tenant.id, phone }, { onConflict: "tenant_id" });
  }

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
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = host.includes("localhost") ? "http" : "https";
  const origin = host ? `${proto}://${host}` : "";

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
