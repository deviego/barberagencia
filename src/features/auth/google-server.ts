import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AREAS } from "@/lib/supabase/area";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { TENANT_COOKIE } from "@/lib/tenant/resolve";
import type { PendingShop } from "./google-types";

/*
 * Peças de servidor do "Entrar com Google" (#170). Por que service role nas leituras de vínculo e
 * barbearia: a conta pendente ainda não tem vínculo nenhum, então a RLS não mostra nada para ela;
 * o usuário vem sempre da sessão (cookie da área do cliente) e a barbearia do cookie bb_tenant,
 * validada aqui. Nada vem de parâmetro do navegador.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Cliente Supabase sempre com o cookie da ÁREA DO CLIENTE (sb-cli, /client), mesmo se o navegador
 * tiver a sessão de equipe do "ver como cliente". Usado pelo callback do cliente.
 */
export async function createClientAreaSupabase() {
  const cookieStore = await cookies();
  const area = AREAS.client;
  const { url, anonKey } = supabasePublicEnv();
  return createServerClient(url, anonKey, {
    cookieOptions: { name: area.name, path: area.path, sameSite: "lax", secure: true },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}

/** O usuário tem algum vínculo (cliente, equipe ou distribuidor)? null = leitura falhou. */
export async function hasAnyMembership(admin: Admin, userId: string): Promise<boolean | null> {
  const { count, error } = await admin
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return null;
  return (count ?? 0) > 0;
}

export type ShopFromCookie = { id: string; slug: string; shop: PendingShop };

/**
 * Barbearia do cookie bb_tenant, validada no servidor: existe, é barbearia (não distribuidor) e
 * não está suspensa. null = sem barbearia válida.
 */
export async function shopFromCookie(admin: Admin): Promise<ShopFromCookie | null> {
  const slug = (await cookies()).get(TENANT_COOKIE)?.value ?? "";
  if (!/^[a-z0-9-]{1,63}$/.test(slug)) return null;
  const { data: t, error } = await admin
    .from("tenants")
    .select("id, name, subdomain, kind, status")
    .eq("subdomain", slug)
    .maybeSingle();
  if (error || !t) return null;
  if ((t.kind as string | null) === "DISTRIBUTOR" || t.status === "SUSPENDED") return null;
  const { data: b } = await admin
    .from("branding")
    .select("logo_text, logo_url, accent")
    .eq("tenant_id", t.id)
    .maybeSingle();
  return {
    id: t.id as string,
    slug,
    shop: {
      name: t.name as string,
      logoText: (b?.logo_text as string | null) ?? "BO",
      logoUrl: (b?.logo_url as string | null) ?? null,
      accent: (b?.accent as string | null) ?? null,
    },
  };
}
