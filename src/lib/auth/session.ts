import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/rbac";

export interface SessionUser {
  id: string;
  email: string | null;
  role: Role | null;
  tenantId: string | null;
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

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (membership?.role as Role | undefined) ?? null,
    tenantId: (membership?.tenant_id as string | undefined) ?? null,
  };
});
