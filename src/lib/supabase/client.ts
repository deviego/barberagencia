"use client";
import { createBrowserClient } from "@supabase/ssr";
import { areaFromKey, areaKeyFor } from "./area";

/** Supabase client no browser (anon key, sob RLS) usando o cookie da ÁREA atual. */
export function createSupabaseBrowserClient() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/client";
  const area = areaFromKey(areaKeyFor(path));
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: area.name, path: area.path, sameSite: "lax", secure: true },
    }
  );
}
