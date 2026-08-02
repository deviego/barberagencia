import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { AREA_HEADER, areaFromKey } from "./area";
import { ACT_COOKIE, isUuid } from "@/lib/auth/acting";

/** Supabase client no servidor (RLS sob o JWT do usuário via cookies da ÁREA). */
export async function createSupabaseServerClient() {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
  const area = areaFromKey(hdrs.get(AREA_HEADER));

  // Modo "atuar como" (MASTER): repassa o tenant escolhido ao PostgREST. O banco só
  // honra este header para usuários MASTER (ver auth_tenant_id em schema-actas.sql).
  const actRaw = cookieStore.get(ACT_COOKIE)?.value;
  const actHeader = isUuid(actRaw) ? { "x-act-tenant": actRaw! } : undefined;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: actHeader ? { headers: actHeader } : undefined,
      cookieOptions: { name: area.name, path: area.path, sameSite: "lax", secure: true },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // chamado de um Server Component — ignorar (o middleware renova a sessão)
          }
        },
      },
    }
  );
}
