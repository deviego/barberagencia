import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { AREA_HEADER, areaFromKey } from "./area";

/** Supabase client no servidor (RLS sob o JWT do usuário via cookies da ÁREA). */
export async function createSupabaseServerClient() {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
  const area = areaFromKey(hdrs.get(AREA_HEADER));
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
