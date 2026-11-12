import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdminEnv } from "./env.server";

/**
 * Client privilegiado (service role) — SERVER-ONLY, ignora RLS.
 * Usar apenas em rotinas administrativas controladas (webhooks, jobs).
 * Nunca importar em componente de cliente.
 */
export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = supabaseAdminEnv();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
