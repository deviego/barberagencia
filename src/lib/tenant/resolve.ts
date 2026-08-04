import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import type { ResolvedTenant, SaasPlanKey } from "./types";

export const TENANT_COOKIE = "bb_tenant";

/** Tenant neutro para visitantes anônimos SEM contexto de barbearia (nunca expõe outra barbearia). */
const NEUTRAL_TENANT: ResolvedTenant = {
  id: "",
  name: "Barber Agência",
  subdomain: "",
  customDomain: null,
  networkId: null,
  saasPlan: "advance",
  branding: { logoText: "BB", logoUrl: null, instagram: null },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

function mapPlan(v: string | null | undefined): SaasPlanKey {
  return v === "personal" || v === "essencial" || v === "advance" ? v : "advance";
}

/** Carrega tenant + branding do banco usando o client informado (RLS ou service-role). */
async function loadTenantWith(supabase: SB, where: { id?: string; subdomain?: string }): Promise<ResolvedTenant | null> {
  let q = supabase.from("tenants").select("id, name, subdomain, custom_domain, saas_plan");
  if (where.id) q = q.eq("id", where.id);
  else if (where.subdomain) q = q.eq("subdomain", where.subdomain);
  const { data: t } = await q.limit(1).maybeSingle();
  if (!t) return null;

  const { data: b } = await supabase
    .from("branding")
    .select("logo_text, logo_url, accent, accent_hover, accent_down, accent_wash, focus, instagram")
    .eq("tenant_id", t.id)
    .maybeSingle();

  return {
    id: t.id as string,
    name: t.name as string,
    subdomain: t.subdomain as string,
    customDomain: (t.custom_domain as string | null) ?? null,
    networkId: null,
    saasPlan: mapPlan(t.saas_plan as string | null),
    branding: {
      logoText: (b?.logo_text as string | null) ?? "BO",
      logoUrl: (b?.logo_url as string | null) ?? null,
      accent: (b?.accent as string | null) ?? null,
      accentHover: (b?.accent_hover as string | null) ?? null,
      accentDown: (b?.accent_down as string | null) ?? null,
      accentWash: (b?.accent_wash as string | null) ?? null,
      focus: (b?.focus as string | null) ?? null,
      instagram: (b?.instagram as string | null) ?? null,
    },
  };
}

/** Público/anônimo: usa service-role (RLS não permite mais leitura cross-tenant). */
export const getTenantBySubdomain = cache(async (slug: string): Promise<ResolvedTenant | null> => {
  let admin: SB;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return null; // sem service-role configurada
  }
  return loadTenantWith(admin, { subdomain: slug });
});

/** Usuário logado: client normal, RLS restringe ao próprio tenant. */
export const getTenantById = cache(async (id: string): Promise<ResolvedTenant | null> => {
  const supabase = await createSupabaseServerClient();
  return loadTenantWith(supabase, { id });
});

/**
 * Tenant atual:
 * 1) logado → tenant do membership;
 * 2) anônimo → cookie `bb_tenant` (definido pelo link /b/{slug});
 * 3) sem contexto → marca neutra "barberagencia" (NUNCA a de outra barbearia).
 */
export const getCurrentTenant = cache(async (): Promise<ResolvedTenant> => {
  const user = await getSessionUser();
  if (user?.tenantId) {
    const t = await getTenantById(user.tenantId);
    if (t) return t;
  }
  const slug = (await cookies()).get(TENANT_COOKIE)?.value;
  if (slug) {
    const t = await getTenantBySubdomain(slug);
    if (t) return t;
  }
  return NEUTRAL_TENANT;
});
