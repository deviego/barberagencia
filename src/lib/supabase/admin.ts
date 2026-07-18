import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client privilegiado (service role) — SERVER-ONLY, ignora RLS.
 * Usar apenas em rotinas administrativas controladas (webhooks, jobs).
 * Nunca importar em componente de cliente.
 */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
