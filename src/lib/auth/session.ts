import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/rbac";

export interface SessionUser {
  id: string;
  email: string | null;
  role: Role | null;
  tenantId: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Usuário da sessão atual (SSR, sob RLS) + papel/tenant do membership.
 * `cache` deduplica a chamada dentro da mesma requisição.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase.from("memberships").select("role, tenant_id").eq("user_id", user.id),
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
  ]);

  // Escolhe o membership de MAIOR papel (evita um master com membership CLIENT cair como cliente).
  const RANK: Record<string, number> = { CLIENT: 0, UNIT_ADMIN: 1, NETWORK_ADMIN: 2, MASTER: 3 };
  const top = (memberships ?? []).reduce<{ role?: string; tenant_id?: string } | null>((best, m) => {
    if (!best || (RANK[m.role as string] ?? -1) > (RANK[best.role as string] ?? -1)) return m;
    return best;
  }, null);

  return {
    id: user.id,
    email: user.email ?? null,
    role: (top?.role as Role | undefined) ?? null,
    tenantId: (top?.tenant_id as string | undefined) ?? null,
    name: (profile?.full_name as string | undefined) ?? null,
    avatarUrl: (profile?.avatar_url as string | undefined) ?? null,
  };
});
