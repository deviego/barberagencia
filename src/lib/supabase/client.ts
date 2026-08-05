"use client";
import { createBrowserClient } from "@supabase/ssr";
import { STAFF, areaFromKey, areaKeyFor } from "./area";
import { VIEW_AS_CLIENT_COOKIE } from "@/lib/auth/preview";

/** Supabase client no browser (anon key, sob RLS) usando o cookie da ÁREA atual. */
export function createSupabaseBrowserClient() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/client";
  const areaKey = areaKeyFor(path);
  // "Ver como cliente": no /client, a equipe usa a sessão de equipe (sb-stf).
  const cookie = typeof document !== "undefined" ? document.cookie : "";
  const previewAsClient = areaKey === "client" && cookie.includes(`${VIEW_AS_CLIENT_COOKIE}=1`) && cookie.includes("sb-stf");
  const area = previewAsClient ? STAFF : areaFromKey(areaKey);
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: area.name, path: area.path, sameSite: "lax", secure: true },
    }
  );
}
