"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { getRequestOrigin } from "@/lib/http";
import { DISTRIBUTOR_PLAN_DEFAULT } from "@/lib/entitlements";

function tempPassword() {
  return "Db" + randomUUID().replace(/-/g, "").slice(0, 10) + "#7";
}
function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 32) || "distribuidor"
  );
}

export type CreateDistributorInput = {
  name: string;
  adminEmail: string;
  adminName?: string;
  phone?: string;
  trialEnabled?: boolean;
  contract?: {
    legalName?: string;
    docType?: string;
    docNumber?: string;
    responsibleName?: string;
    responsibleCpf?: string;
    addressStreet?: string;
    addressCity?: string;
    addressState?: string;
    addressZip?: string;
  };
};

/** MASTER cria um DISTRIBUIDOR (tenant kind=DISTRIBUTOR + admin UNIT_ADMIN). Espelha createTenant. */
export async function createDistributor(input: CreateDistributorInput) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };

  const name = input.name.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (!name || !adminEmail) return { ok: false as const, error: "Preencha o nome e o e-mail do responsável." };

  const admin = createSupabaseAdminClient();

  // Slug sintético único (com prefixo p/ não colidir com barbearias).
  const baseSlug = `dist-${slugify(name)}`;
  let subdomain = baseSlug;
  for (let i = 0; i < 6; i++) {
    const { data: exists } = await admin.from("tenants").select("id").eq("subdomain", subdomain).maybeSingle();
    if (!exists) break;
    subdomain = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // 1) tenant (kind=DISTRIBUTOR, plano de distribuidor)
  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .insert({ name, subdomain, kind: "DISTRIBUTOR", saas_plan: DISTRIBUTOR_PLAN_DEFAULT, status: "ACTIVE" })
    .select("id")
    .single();
  if (tErr || !tenant) return { ok: false as const, error: tErr?.message ?? "Falha ao criar o distribuidor (aplique schema-25?)." };

  await admin.from("branding").insert({ tenant_id: tenant.id, logo_text: name.slice(0, 2).toUpperCase() });

  const phone = input.phone?.trim();
  if (phone) await admin.from("tenant_settings").upsert({ tenant_id: tenant.id, phone }, { onConflict: "tenant_id" });

  // Contrato (trial + dados legais)
  const trialEnabled = input.trialEnabled !== false;
  const now = new Date();
  const trialEnds = new Date(now.getTime() + (trialEnabled ? 15 * 24 * 60 * 60 * 1000 : 0));
  const c = input.contract ?? {};
  const clean = (s?: string) => (s && s.trim() ? s.trim() : null);
  await admin.from("tenant_contracts").upsert(
    {
      tenant_id: tenant.id,
      plan: DISTRIBUTOR_PLAN_DEFAULT,
      trial_enabled: trialEnabled,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      status: "PENDING",
      legal_name: clean(c.legalName),
      trade_name: name,
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

  // 2) usuário admin (trigger cria membership CLIENT via tenant_subdomain) → promove a UNIT_ADMIN
  const password = tempPassword();
  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.adminName ?? name, tenant_subdomain: subdomain },
  });
  if (uErr || !created?.user) {
    await admin.from("tenants").delete().eq("id", tenant.id);
    return { ok: false as const, error: `Falha ao criar o admin: ${uErr?.message ?? "erro"}` };
  }
  await admin.from("memberships").update({ role: "UNIT_ADMIN" }).eq("user_id", created.user.id).eq("tenant_id", tenant.id);

  const origin = await getRequestOrigin();
  revalidatePath("/master/distribuidores");
  return {
    ok: true as const,
    adminLoginUrl: `${origin}/distributor/login`,
    adminEmail,
    password,
    name,
    phone: phone ?? "",
  };
}
